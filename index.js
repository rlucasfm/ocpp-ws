const { RPCServer, createRPCError } = require('ocpp-rpc');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ilzllznmgmdxywezwddn.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlsemxsem5tZ21keHl3ZXp3ZGRuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDgyNjg2NjYsImV4cCI6MjA2Mzg0NDY2Nn0.Vm8rSm3bOSAgIQXSi4aqydS25ownLRIdRLUFS1MiXrY'; // use a chave de "service role" para poder atualizar registros
const supabase = createClient(supabaseUrl, supabaseKey);

const server = new RPCServer({
    protocols: ['ocpp1.6'], // aceita conexões OCPP 1.6
    strictMode: true,       // valida mensagens conforme o protocolo
});

server.auth((accept, reject, handshake) => {
    // Aceita qualquer cliente (pode customizar para autenticação)
    // console.info('Handshake:', handshake);
    accept({ sessionId: handshake.identity });
});

// Mapeia clientes conectados pelo chargePointId
const clientesOcpp = {}; // { chargePointId: client }

server.on('client', async (client) => {
    console.log(`${client.session.sessionId} conectado!`);

    const id = client.identity;
    clientesOcpp[id] = client;

    console.log(`Registrado cliente ${id} no pool de conexões.`);

    client.on('close', () => {
        delete clientesOcpp[id];
        console.log(`Cliente ${id} desconectado e removido.`);
    });

    client.handle('BootNotification', ({params}) => {
        console.log(`BootNotification de ${client.identity}:`, params);
        return {
            status: "Accepted",
            interval: 300,
            currentTime: new Date().toISOString()
        };
    });

    client.handle('Authorize', ({params}) => {
        console.log(`Authorize de ${client.identity}:`, params);
        return {
            idTagInfo: {
                status: "Accepted"
            }
        };
    });

    client.handle('Heartbeat', ({params}) => {
        console.log(`Heartbeat de ${client.identity}:`, params);
        return {
            currentTime: new Date().toISOString()
        };
    });

    client.handle('StatusNotification', ({params}) => {
        console.log(`StatusNotification de ${client.identity}:`, params);
        return {};
    });

    client.handle('MeterValues', ({params}) => {
        console.log(`MeterValues de ${client.identity}:`, params);
        return {};
    });

    client.handle('StartTransaction', ({params}) => {
        console.log(`StartTransaction de ${client.identity}:`, params);
        return {
            transactionId: Math.floor(Math.random() * 100000),
            idTagInfo: {
                status: "Accepted"
            }
        };
    });

    client.handle('StopTransaction', async ({params}) => {
        console.log(`StopTransaction de ${client.identity}:`, params);
        const { transactionId, timestamp, meterStop, idTag } = params;

        // 1. Achar o start_request mais recente com o idTag.
        const { data: startRequest, error: startRequestError } = await supabase
            .from('start_requests')
            .select('*')
            .eq('id_tag', idTag)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (startRequestError || !startRequest) {
            console.error(`StopTransaction: Não foi possível encontrar um start_request para o idTag ${idTag}.`, startRequestError);
            return { idTagInfo: { status: "Accepted" } }; // Aceita para não bloquear a estação
        }

        // 2. Usar o session_id do start_request para achar a charging_session.
        const { data: chargingSession, error: chargingSessionError } = await supabase
            .from('charging_sessions')
            .select('*')
            .eq('id', startRequest.session_id)
            .single();
        
        if (chargingSessionError || !chargingSession) {
            console.error(`StopTransaction: Sessão de carregamento com id ${startRequest.session_id} não encontrada.`, chargingSessionError);
            return { idTagInfo: { status: "Accepted" } };
        }

        // 3. Calcular dados de carga
        let cargaTotalKwh = 0;
        let cargaMediaKw = 0;
        let custo_total = 0;

        // A melhor abordagem é usar meterStart da sessão e meterStop da parada.
        const meterStart = chargingSession.meter_start || 0;
        if (meterStop > meterStart) {
            const totalEnergyWh = meterStop - meterStart;
            cargaTotalKwh = totalEnergyWh / 1000;
        }

        const startTime = new Date(chargingSession.created_at);
        const stopTime = new Date(timestamp);
        const durationMs = stopTime.getTime() - startTime.getTime();
        
        if (durationMs > 0 && cargaTotalKwh > 0) {
            const durationHours = durationMs / (1000 * 60 * 60);
            cargaMediaKw = cargaTotalKwh / durationHours;
        }

        custo_total = cargaTotalKwh * startRequest.preco_kwh;

        // 4. Atualizar a sessão no banco
        const { error: updateError } = await supabase
            .from('charging_sessions')
            .update({
                status: 'finalizado',
                carga_total_kwh: cargaTotalKwh,
                carga_media_kw: cargaMediaKw.toFixed(2),
                custos: custo_total,
                total_pago: custo_total
            })
            .eq('id', chargingSession.id);

        if (updateError) {
            console.error(`StopTransaction: Erro ao finalizar a sessão ${chargingSession.id}.`, updateError);
        } else {
            console.log(`Sessão ${chargingSession.id} (Transaction ID: ${transactionId}) finalizada com sucesso.`);
        }

        // 5. Capturar pagamento na Pagar.me, se houver charge_provider_id
        if (chargingSession.charge_provider_id) {
            try {
                const { PagarmeService } = require('./PagarmeService');
                const pagarme = new PagarmeService();
                const captura = await pagarme.capturarCobranca(chargingSession.charge_provider_id, custo_total);
                console.log('Cobrança capturada com sucesso na Pagar.me:', captura);
            } catch (err) {
                console.error('Erro ao capturar cobrança na Pagar.me:', err);
            }
        } else {
            console.warn('Nenhum charge_provider_id encontrado para esta sessão, não foi possível capturar cobrança.');
        }

        return {
            idTagInfo: {
                status: "Accepted"
            }
        };
    });

    client.handle(({method, params}) => {
        // console.log(`Método OCPP não tratado (${method}) de ${client.identity}:`, params);
        throw createRPCError("NotImplemented");
    });
});

server.listen(3000).then(() => {
    console.info('Servidor OCPP 1.6 WebSocket iniciado na porta 3000');
});

supabase
  .channel('start_requests_changes')
  .on(
    'postgres_changes',
    { event: 'INSERT', schema: 'public', table: 'start_requests' },
    async (payload) => {
      const { id_tag, charge_point_id, connector_id, id, session_id } = payload.new;

      const client = clientesOcpp[charge_point_id];
      if (!client) {
        console.warn(`Estação ${charge_point_id} não está conectada.`);
        await supabase.from('start_requests').update({ status: 'erro' }).eq('id', id);
        return;
      }

      try {
        const response = await client.call('RemoteStartTransaction', {
          connectorId: connector_id,
          idTag: id_tag
        });

        console.log(`Comando enviado a ${charge_point_id}, resposta:`, response);
        await supabase.from('start_requests').update({ status: 'processado' }).eq('id', id);
        
        console.log(`Atualizando status para processado e em_andamento session_id: ${session_id}`);
        const { data, error } = await supabase.from('charging_sessions').update({ status: 'em_andamento' }).eq('id', session_id);

        if (error) {
            console.error('Erro ao atualizar charging_sessions:', error);
        } else {
            console.log('Sessão de carregamento atualizada com sucesso:', data);
        }
      } catch (error) {
        console.error(`Erro ao enviar para ${charge_point_id}:`, error);
        await supabase.from('start_requests').update({ status: 'erro' }).eq('id', id);
      }
    }
  )
  .subscribe();

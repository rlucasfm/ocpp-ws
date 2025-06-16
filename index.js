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

    client.handle('StopTransaction', ({params}) => {
        console.log(`StopTransaction de ${client.identity}:`, params);
        // Se params.idTag existir, retorne idTagInfo
        if (params.idTag) {
            return {
                idTagInfo: {
                    status: "Accepted"
                }
            };
        }
        // Caso contrário, pode retornar um objeto vazio
        return {};
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
      const { id_tag, charge_point_id, connector_id, id } = payload.new;

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
      } catch (error) {
        console.error(`Erro ao enviar para ${charge_point_id}:`, error);
        await supabase.from('start_requests').update({ status: 'erro' }).eq('id', id);
      }
    }
  )
  .subscribe();

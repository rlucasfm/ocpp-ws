const WebSocket = require('ws');

// Cria um servidor WebSocket na porta 3000
const wss = new WebSocket.Server({ port: 3000 });

console.info('Servidor WebSocket iniciado na porta 3000');

// Evento disparado quando um novo cliente (Charge Point) se conecta
wss.on('connection', function connection(ws) {
  console.log('Charge Point conectado');

  // Evento disparado quando o servidor recebe uma mensagem do cliente
  ws.on('message', function incoming(message) {
    let parsed;
    try {
      // Tenta converter a mensagem recebida para JSON
      parsed = JSON.parse(message.toString());
    } catch (e) {
      console.error('Mensagem inválida:', message.toString());
      return;
    }
    // Mensagens OCPP-J são arrays: [MessageTypeId, UniqueId, Action, Payload]
    if (!Array.isArray(parsed) || parsed.length < 3) {
      console.error('Mensagem OCPP inválida:', parsed);
      return;
    }
    const [typeId, uniqueId, action, params] = parsed;
    // Só processa mensagens do tipo CALL (typeId === 2)
    if (typeId !== 2) return;

    let responsePayload = {};
    switch (action) {
      case 'BootNotification':
        // Mensagem enviada pelo Charge Point ao iniciar
        console.log(`BootNotification:`, params);
        responsePayload = {
          status: "Accepted",
          interval: 300,
          currentTime: new Date().toISOString()
        };
        break;
      case 'Authorize':
        // Mensagem de autorização de usuário/cartão
        console.log(`Authorize:`, params);
        responsePayload = {
          status: "Accepted"
        };
        break;
      case 'Heartbeat':
        // Mensagem periódica para manter a conexão viva
        console.log(`Heartbeat:`, params);
        responsePayload = {
          currentTime: new Date().toISOString()
        };
        break;
      case 'StatusNotification':
        // Notificação de mudança de status do conector
        console.log(`StatusNotification:`, params);
        responsePayload = {};
        break;
      case 'MeterValues':
        // Leituras periódicas do medidor de energia
        // console.log(`MeterValues:`, params);
        responsePayload = {};
        break;
      case 'StartTransaction':
        // Início de uma sessão de carregamento
        console.log(`StartTransaction:`, params);
        responsePayload = {
          transactionId: Math.floor(Math.random() * 100000), // Gera um ID de transação aleatório
          idTagInfo: {
            status: "Accepted"
          }
        };
        break;
      case 'StopTransaction':
        // Fim de uma sessão de carregamento
        console.log(`StopTransaction:`, params);
        // Se o payload tiver idTag, retorna idTagInfo
        if (params && params.idTag) {
          responsePayload = {
            idTagInfo: {
              status: "Accepted"
            }
          };
        } else {
          responsePayload = {};
        }
        break;
      default:
        // Para métodos OCPP não implementados, responde com erro padrão OCPP
        // CALLERROR: [4, UniqueId, ErrorCode, ErrorDescription, ErrorDetails]
        ws.send(JSON.stringify([4, uniqueId, "NotImplemented", `Método ${action} não implementado`, {}]));
        return;
    }
    // Responde ao cliente com CALLRESULT: [3, UniqueId, Payload]
    ws.send(JSON.stringify([3, uniqueId, responsePayload]));
  });
});

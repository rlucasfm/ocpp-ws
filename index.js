const { RPCServer, createRPCError } = require('ocpp-rpc');

const server = new RPCServer({
    protocols: ['ocpp1.6'], // aceita conexões OCPP 1.6
    strictMode: true,       // valida mensagens conforme o protocolo
});

server.auth((accept, reject, handshake) => {
    // Aceita qualquer cliente (pode customizar para autenticação)
    // console.info('Handshake:', handshake);
    accept({ sessionId: handshake.identity });
});

server.on('client', async (client) => {
    console.log(`${client.session.sessionId} conectado!`);

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

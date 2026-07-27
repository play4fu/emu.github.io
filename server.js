const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Раздаем статику
app.use(express.static(path.join(__dirname, 'public')));

// Хранилище клиентов
const clients = {
    screen: null,      // Один экран (ПК с эмулятором)
    controllers: []    // Телефоны-контроллеры
};

// WebSocket обработка
wss.on('connection', (ws, req) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const role = url.searchParams.get('role');

    console.log(`Подключен ${role}`);

    if (role === 'screen') {
        // Экран (ПК)
        if (clients.screen) {
            clients.screen.close();
        }
        clients.screen = ws;
        
        ws.on('message', (message) => {
            try {
                const data = JSON.parse(message);
                // Можно добавить обработку команд с экрана
            } catch (e) {}
        });

        ws.on('close', () => {
            clients.screen = null;
            console.log('Экран отключен');
        });

        ws.send(JSON.stringify({ 
            type: 'connected', 
            role: 'screen',
            message: 'Экран подключен' 
        }));

    } else if (role === 'controller') {
        // Контроллер (телефон)
        const playerId = clients.controllers.length;
        clients.controllers.push(ws);
        
        // Уведомляем экран о новом игроке
        if (clients.screen) {
            clients.screen.send(JSON.stringify({
                type: 'player_joined',
                count: clients.controllers.length
            }));
        }

        ws.on('message', (message) => {
            try {
                const data = JSON.parse(message);
                // Пересылаем команды с телефона на экран
                if (clients.screen && clients.screen.readyState === WebSocket.OPEN) {
                    clients.screen.send(JSON.stringify({
                        type: 'controller_input',
                        playerId: playerId,
                        data: data
                    }));
                }
            } catch (e) {}
        });

        ws.on('close', () => {
            const index = clients.controllers.indexOf(ws);
            if (index !== -1) {
                clients.controllers.splice(index, 1);
            }
            
            if (clients.screen) {
                clients.screen.send(JSON.stringify({
                    type: 'player_left',
                    count: clients.controllers.length
                }));
            }
            console.log('Контроллер отключен');
        });

        ws.send(JSON.stringify({ 
            type: 'connected', 
            role: 'controller',
            playerId: playerId,
            message: 'Контроллер подключен' 
        }));
    }
});

// Функция для отправки всем контроллерам
function broadcastToControllers(message) {
    const data = JSON.stringify(message);
    clients.controllers.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(data);
        }
    });
}

const PORT = process.env.PORT || 8080;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Сервер запущен на порту ${PORT}`);
    console.log(`Откройте: http://localhost:${PORT}`);
});

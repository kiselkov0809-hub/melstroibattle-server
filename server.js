            const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: process.env.PORT || 8080 });

let rooms = {};
let matchmaking = [];

wss.on('connection', function(ws) {
    ws.on('message', function(msg) {
        try {
            const data = JSON.parse(msg);
            handleMessage(ws, data);
        } catch(e) {}
    });
    
    ws.on('close', function() {
        matchmaking = matchmaking.filter(function(m) { return m.ws !== ws; });
        for (let roomId in rooms) {
            if (rooms[roomId].p1 === ws || rooms[roomId].p2 === ws) {
                const opponent = rooms[roomId].p1 === ws ? rooms[roomId].p2 : rooms[roomId].p1;
                if (opponent) opponent.send(JSON.stringify({ type: 'opponent_left' }));
                delete rooms[roomId];
            }
        }
    });
});

function handleMessage(ws, data) {
    if (data.type === 'join_queue') {
        let maxHP = 100;
        if (data.character === 'fog') maxHP = 200;
        if (data.character === 'cat') maxHP = 300;
        if (data.character === 'batnost') maxHP = 120;
        
        matchmaking.push({ 
            ws: ws, 
            nick: data.nick, 
            character: data.character || 'melstroy',
            maxHP: maxHP
        });
        ws.send(JSON.stringify({ type: 'queue_joined' }));
        if (matchmaking.length >= 2) {
            const p1 = matchmaking.shift();
            const p2 = matchmaking.shift();
            const roomId = Date.now();
            rooms[roomId] = { p1: p1.ws, p2: p2.ws };
            p1.ws.send(JSON.stringify({ 
                type: 'match_found', 
                opponent: p2.nick, 
                side: 'left', 
                opponentCharacter: p2.character,
                opponentMaxHP: p2.maxHP
            }));
            p2.ws.send(JSON.stringify({ 
                type: 'match_found', 
                opponent: p1.nick, 
                side: 'right', 
                opponentCharacter: p1.character,
                opponentMaxHP: p1.maxHP
            }));
        }
    }
    
    if (data.type === 'move') {
        for (let roomId in rooms) {
            const room = rooms[roomId];
            if (room.p1 === ws) room.p2.send(JSON.stringify({ type: 'opponent_move', x: data.x }));
            if (room.p2 === ws) room.p1.send(JSON.stringify({ type: 'opponent_move', x: data.x }));
        }
    }
    
    if (data.type === 'attack') {
        for (let roomId in rooms) {
            const room = rooms[roomId];
            if (room.p1 === ws) room.p2.send(JSON.stringify({ type: 'opponent_attack', dmg: data.dmg }));
            if (room.p2 === ws) room.p1.send(JSON.stringify({ type: 'opponent_attack', dmg: data.dmg }));
        }
    }
    
    if (data.type === 'game_over') {
        for (let roomId in rooms) {
            const room = rooms[roomId];
            if (room.p1 === ws) {
                room.p2.send(JSON.stringify({ type: 'game_result', win: false }));
                delete rooms[roomId];
            }
            if (room.p2 === ws) {
                room.p1.send(JSON.stringify({ type: 'game_result', win: false }));
                delete rooms[roomId];
            }
        }
    }
}

console.log('Server running');

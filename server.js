                    const WebSocket = require('ws');

const wss = new WebSocket.Server({ port: process.env.PORT || 8080 });

let rooms = {};
let matchmaking = [];

wss.on('connection', (ws) => {
    ws.id = Date.now() + Math.random();
    
    ws.on('message', (msg) => {
        try {
            const data = JSON.parse(msg);
            handleMessage(ws, data);
        } catch(e) {}
    });
    
    ws.on('close', () => {
        matchmaking = matchmaking.filter(m => m.ws !== ws);
        for (let roomId in rooms) {
            const room = rooms[roomId];
            if (room.p1 === ws || room.p2 === ws) {
                const opponent = room.p1 === ws ? room.p2 : room.p1;
                if (opponent) {
                    opponent.send(JSON.stringify({ type: 'opponent_left' }));
                }
                delete rooms[roomId];
            }
        }
    });
});

function handleMessage(ws, data) {
    switch(data.type) {
        case 'join_queue':
            matchmaking.push({ 
                ws, 
                nick: data.nick, 
                character: data.character || 'melstroy',
                weapon: data.weapon || null,
                artifacts: data.artifacts || [],
                pet: data.pet || null
            });
            ws.send(JSON.stringify({ type: 'queue_joined' }));
            findMatch(ws);
            break;
            
        case 'move':
            const room1 = findRoom(ws);
            if (room1) {
                const opponent = room1.p1 === ws ? room1.p2 : room1.p1;
                if (opponent) {
                    opponent.send(JSON.stringify({ type: 'opponent_move', x: data.x }));
                }
            }
            break;
            
        case 'attack':
            const room2 = findRoom(ws);
            if (room2) {
                const opponent = room2.p1 === ws ? room2.p2 : room2.p1;
                if (opponent) {
                    opponent.send(JSON.stringify({ type: 'opponent_attack', dmg: data.dmg }));
                }
            }
            break;
            
        case 'game_over':
            const room3 = findRoom(ws);
            if (room3) {
                const opponent = room3.p1 === ws ? room3.p2 : room3.p1;
                if (opponent) {
                    opponent.send(JSON.stringify({ type: 'game_result', win: false }));
                }
                delete rooms[room3.id];
            }
            break;
    }
}

function findMatch(ws) {
    if (matchmaking.length >= 2) {
        const p1 = matchmaking.shift();
        const p2 = matchmaking.shift();
        
        const roomId = Date.now() + Math.random();
        rooms[roomId] = { 
            p1: p1.ws, 
            p2: p2.ws, 
            nick1: p1.nick, 
            nick2: p2.nick
        };
        
        p1.ws.send(JSON.stringify({ 
            type: 'match_found', 
            opponent: p2.nick, 
            side: 'left', 
            opponentCharacter: p2.character || 'melstroy',
            opponentWeapon: p2.weapon || null,
            opponentArtifacts: p2.artifacts || [],
            opponentPet: p2.pet || null
        }));
        p2.ws.send(JSON.stringify({ 
            type: 'match_found', 
            opponent: p1.nick, 
            side: 'right', 
            opponentCharacter: p1.character || 'melstroy',
            opponentWeapon: p1.weapon || null,
            opponentArtifacts: p1.artifacts || [],
            opponentPet: p1.pet || null
        }));
    }
}

function findRoom(ws) {
    for (let roomId in rooms) {
        if (rooms[roomId].p1 === ws || rooms[roomId].p2 === ws) {
            return rooms[roomId];
        }
    }
    return null;
}

console.log('WebSocket server running');

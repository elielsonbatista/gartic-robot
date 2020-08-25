const axios = require('axios');
const socket = require('socket.io-client');
const inquirer = require('inquirer');

class GarticRobot
{
    constructor() {
        this.user = {};
    }

    async createUser(user) {
        if (! user) {
            user = {};
        }

        try {
            let body = {
                avatar: 0,
                language: 1,
                name: `u-${+ new Date}`,
                ...user
            };
    
            let { data } = await axios.post('https://gartic.io/req/user', body);

            if (data) {
                this.user = body;
            } else {
                throw "User can't be created";
            }
        } catch (error) {
            console.log(error);
        }
        
        return this.user;
    }
    
    async joinRoom(room) {
        let server = await this.getServer(room);
        let client = socket(`wss://${server}`);
        
        client.on('connect', () => {
            let data = {
                avatar: this.user.avatar,
                nick: this.user.name,
                sala: room,
                v: 20000
            };
            
            client.emit(3, data);
        });

        client.on(5, async (token, id) => {
            this.user.token = token;
            this.user.id = id;

            client.emit(46, id);
        });

        client.on('disconnect', () => {
            console.log('Disconnected');
        });

        client.on(16, async (optionOne, syllablesOptionsOne, optionTwo, syllablesOptionsTwo) => {
            let choices = [
                optionOne,
                optionTwo
            ];

            let { draw } = await inquirer.prompt([{
                type: 'list',
                name: 'draw',
                message: 'Choose a drawing',
                choices
            }]);

            client.emit(34, this.user.id, choices.indexOf(draw));
        });
    }

    async getServer(room) {
        try {
            let params = {
                check: 1
            };

            if (room) {
                params.room = room;
            }

            let { data } = await axios.get('https://gartic.io/server', { params });

            return data.replace('https://', '');
        } catch (error) {
            console.log(error);
        }

        return false;
    }
}

(async () => {
    let robot = new GarticRobot;

    try {
        await robot.createUser();

        let { room } = await inquirer.prompt([{
            type: 'input',
            name: 'room',
            message: 'Room'
        }]);

        robot.joinRoom(room);
    } catch (error) {
        console.log(error);
    }
})();

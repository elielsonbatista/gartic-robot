const axios = require('axios');
const colorConvert = require('color-convert');
const jimp = require('jimp');
const inquirer = require('inquirer');
const socket = require('socket.io-client');

class GarticRobot
{
    constructor() {
        this.user = {};

        this.draw = {
            color: 'x000000'
        };
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

            client.once(34, async () => {
                let { url } = await inquirer.prompt([{
                    type: 'input',
                    name: 'url',
                    message: 'Image URL'
                }]);

                let image = await jimp.read(url);

                image.resize(350, 350);
    
                let { data, height, width } = image.bitmap;
                let pixels = {};
    
                image.scan(0, 0, width, height, function(x, y, idx) {
                    if ((x === 0 || ! (x % 4)) && (y === 0 || ! (y % 4))) {
                        let red = data[idx];
                        let green = data[idx + 1];
                        let blue = data[idx + 2];
    
                        let color = `x${colorConvert.rgb.hex(red, green, blue)}`;
    
                        if (color === 'xFFFFFF') {
                            return;
                        }
    
                        if (! pixels[color]) {
                            pixels[color] = [];
                        }
    
                        pixels[color].push([x + 40, y + 40]);
                    }
                });
    
                for (let color of Object.keys(pixels)) {
                    client.emit(10, this.user.id, [5, color]);
    
                    for (let pixel of pixels[color]) {
                        client.emit(10, this.user.id, [2, ...pixel]);
                    }
                }
            });
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
        let { name } = await inquirer.prompt([{
            type: 'input',
            name: 'name',
            message: 'User name'
        }]);

        await robot.createUser({ name });

        let { room } = await inquirer.prompt([{
            type: 'input',
            name: 'room',
            message: 'Room'
        }]);

        room = room.replace(/.*gartic.io\//g, '').substr(2, room.length - 2);

        robot.joinRoom(room);
    } catch (error) {
        console.log(error);
    }
})();

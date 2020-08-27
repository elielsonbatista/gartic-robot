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
        });

        client.on(34, async () => {
            let image = await jimp.read('./image-test.jpg');

            let instance = this;
            let { data, height, width } = image.bitmap;
            let counter = 0;

            image.scan(0, 0, width, height, function(x, y, idx) {
                counter++;

                if (counter === 5) {
                    counter = 0;

                    let red = data[idx];
                    let green = data[idx + 1];
                    let blue = data[idx + 2];

                    let color = `x${colorConvert.rgb.hex(red, green, blue)}`;

                    if (color === 'xFFFFFF') {
                        return;
                    }

                    if (instance.draw.color !== color) {
                        instance.draw.color = color;
                        client.emit(10, instance.user.id, [5, color]);
                    }

                    client.emit(10, instance.user.id, [2, x, y]);
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
        await robot.createUser();

        let { room } = await inquirer.prompt([{
            type: 'input',
            name: 'room',
            message: 'Room'
        }]);

        room = room.substr(2, room.length - 2);

        robot.joinRoom(room);
    } catch (error) {
        console.log(error);
    }
})();

// This code below will be implemented to send packets of image coordinaes instead one by one.

/*
    let pixels = {};

    image.scan(0, 0, width, height, function(x, y, idx) {
        let red = data[idx];
        let green = data[idx + 1];
        let blue = data[idx + 2];

        let color = `x${colorConvert.rgb.hex(red, green, blue)}`;

        if (color === 'xFFFFFF') {
            return;
        }

        if (! pixels[color]) {
            pixels[color] = [[]];
        }

        if (pixels[color].length && pixels[color][pixels[color].length - 1].length < 32) {
            pixels[color][pixels[color].length - 1].push(x, y);
        } else {
            pixels[color].push([x, y]);
        }
    });
*/

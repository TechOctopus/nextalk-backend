/*
|--------------------------------------------------------------------------
| Routes
|--------------------------------------------------------------------------
|
| This file is dedicated for defining HTTP routes. A single file is enough
| for majority of projects, however you can define routes in different
| files and just make sure to import them inside this file. For example
|
| Define routes in following two files
| ├── start/routes/cart.ts
| ├── start/routes/customer.ts
|
| and then import them inside `start/routes.ts` as follows
|
| import './routes/cart'
| import './routes/customer'
|
*/

import Route from '@ioc:Adonis/Core/Route'
import Ws from '@ioc:Ruby184/Socket.IO/Ws'

Route.group(() => {
  Route.post('register', 'AuthController.register')
  Route.post('login', 'AuthController.login')
  Route.post('logout', 'AuthController.logout').middleware('auth')
  Route.get('me', 'AuthController.me').middleware('auth')
}).prefix('auth')

Ws.namespace('/')
  .connected('ActivityController.onConnected')
  .disconnected('ActivityController.onDisconnected')

Ws.namespace('channels')
  .on('loadChannels', 'ChannelController.loadChannels')
  .on('joinChannel', 'ChannelController.joinChannel')
  .on('quitChannel', 'ChannelController.quitChannel')
  .on('cancelChannel', 'ChannelController.cancelChannel')
  .on('inviteUser', 'ChannelController.inviteUser')
  .on('revokeUser', 'ChannelController.revokeUser')
  .on('kickUser', 'ChannelController.kickUser')

Ws.namespace('channels/:name')
  .on('loadMessages', 'MessageController.loadMessages')
  .on('addMessage', 'MessageController.addMessage')

import Vue from 'vue'
import App from './App'
import router from './router'
import VueSocketIO from 'vue-socket.io'
import { BACKEND_SOCKETIO } from '../config/prod.env'


Vue.config.productionTip = false

Vue.use(new VueSocketIO({
  debug: true,
  connection: BACKEND_SOCKETIO
}))

/* eslint-disable no-new */
new Vue({
  el: '#app',
  router,
  render: h => h(App)
})

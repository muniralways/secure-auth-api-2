import  type { Server } from 'node:https';





export const closeHttp = async (server : Server): Promise<void> =>{
 if(!server.listening) return

  await new Promise<void> ((resolve, reject) => {
    server.close((error => (error ? reject (error) : resolve())));
    server.closeIdleConnections()
  })


}

import * as fs from "node:fs"
import { NBTWriter } from "./src/writer.js"

const serversDatPath = "C:\\Users\\MAINER4IK\\AppData\\Roaming\\spotlauncher\\intents\\26_1_2\\servers.dat"

const nbt = {
  servers: {
    type: 10,
    values: [
      {
        name: "spot Server",
        ip: "185.9.145.192:30716",
        hidden: 0,
      },
    ],
  },
}

const buffer = new NBTWriter().write(nbt, { compressed: "gzip" })
fs.writeFileSync(serversDatPath, buffer)

console.log("servers.dat создан с сервером 185.9.145.192:30716")

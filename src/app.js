import express from "express"
import cors from "cors"
import { MongoClient } from "mongodb"
import dotenv from "dotenv"

const server = express()

server.use(cors())

server.listen(5000, () => { 
    console.log("Servidor: http://localhost:5000")
})
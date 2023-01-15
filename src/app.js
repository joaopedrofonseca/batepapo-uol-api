import express from "express"
import cors from "cors"
import { MongoClient } from "mongodb"
import dotenv from "dotenv"
import joi from 'joi'

dotenv.config()

const server = express()
server.use(cors())
server.use(express.json())

const mongoClient = new MongoClient(process.env.DATABASE_URL)
let db

try {
    await mongoClient.connect()
    db = mongoClient.db()
} catch (error) {
    console.log("Erro na conexão com o banco de dados")
}

//endpoint PARTICIPANTS
server.post("/participants", async (req, res) => {
    const { name } = req.body

    const participantSchema = joi.object({
        name: joi.string().required()
    })
    const validation = participantSchema.validate({ name })

    if (validation.error){
        const errors = validation.error.details.map((detail) => detail.messsage)
        return res.status(422).send(errors)
    }

    try {
        const participants = await db.collection("participants").find().toArray()
        const names = participants.map(p => p.name)
        if (names.includes(name)){
            res.status(409).send("nome já cadastrado!")
        }
        await db.collection("participants").insertOne({ name : name, lastStatus: Date.now()})
        res.sendStatus(201)
    } catch (error) {
        res.status(500)
    }

})

server.get("/participants", async (req, res) => {
    try {
        const participants = await db.collection("participants").find().toArray()
        res.status(200).send(participants)
    } catch (error) {
        res.status(500)
    }
})

//endpoint MESSAGES

server.listen(5000, () => {
    console.log("Servidor: http://localhost:5000")
})
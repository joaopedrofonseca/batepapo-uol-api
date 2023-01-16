import express from "express"
import cors from "cors"
import { MongoClient } from "mongodb"
import dotenv from "dotenv"
import joi from 'joi'
import dayjs from "dayjs"

dotenv.config()

const server = express()
server.use(cors())
server.use(express.json())

const mongoClient = new MongoClient(process.env.DATABASE_URL)
let db

try {
    await mongoClient.connect()
    db = mongoClient.db()
} catch (error) { console.log("Erro na conexão com o banco de dados") }

//endpoint PARTICIPANTS
server.post("/participants", async (req, res) => {
    const { name } = req.body

    const participantSchema = joi.object({
        name: joi.string().required()
    })
    const validation = participantSchema.validate({ name })

    if (validation.error) {
        const errors = validation.error.details.map((detail) => detail.message)
        return res.status(422).send(errors)
    }

    try {
        const participants = await db.collection("participants").find().toArray()
        const names = participants.map(p => p.name)

        if (names.includes(name)) {
            return res.sendStatus(409)
        }

        await db.collection("participants").insertOne({ name: name, lastStatus: Date.now() })
        await db.collection("messages").insertOne(
            {
                from: name,
                to: 'Todos',
                text: 'entra na sala...',
                type: 'status',
                time: dayjs().format('HH:mm:ss')
            })
        return res.sendStatus(201)
    } catch (error) {
        return res.status(500)
    }

})

server.get("/participants", async (req, res) => {
    try {
        const participants = await db.collection("participants").find().toArray()
        return res.status(200).send(participants)
    } catch (error) {
        return res.status(500)
    }
})

//endpoint MESSAGES
server.post("/messages", async (req, res) => {
    const user = req.headers.user
    const { to, text, type } = req.body
    const messageSchema = joi.object({
        to: joi.string().required(),
        text: joi.string().required(),
        type: joi.any().valid('message', 'private_message').required()
    })
    const validation = messageSchema.validate({ to, text, type })
    const participants = await db.collection("participants").find().toArray()
    const names = participants.map(p => p.name)

    if (validation.error) {
        const errors = validation.error.details.map((detail) => detail.message)
        return res.status(422).send(errors)
    } else if (!user || !names.includes(user)){
        return res.sendStatus(422)
    }
    try {
        await db.collection("messages").insertOne(
            { from: user, to, text, type, time: dayjs().format('HH:mm:ss') }
        )
        return res.sendStatus(201)
    } catch (err) {
        return res.sendStatus(500)
    }
})

server.get("/messages", async (req, res) => {
    const limit = Number(req.query.limit)
    const user = req.headers.user

    if (limit < 1 || isNaN(limit)) return res.sendStatus(422)

    try {
        const messages = await db.collection("messages").find().toArray()
        const reversed = messages.reverse()
        const participants = await db.collection("participants").find().toArray()
        const isNameExist = participants.find(p => p.name === user)

        if (user && isNameExist) {
            if (limit){
                const userLimitMessages = reversed.filter((m, i) => (m.to === user || m.to === "Todos") && i < limit)
                return res.status(200).send(userLimitMessages)
            }
            const userMessages = reversed.filter((m) => m.to === user || m.to === "Todos" || m.from === user)
            return res.status(200).send(userMessages)
        } else if (!user || !isNameExist){
            return res.sendStatus(422)
        }
    } catch (err) {
        res.sendStatus(500)
    }
})

//endpoint STATUS
server.post("/status", async (req, res) => {
    const username = req.headers.user
    const user = await db.collection("participants").findOne({ name: username })
    if (user) {
        await db.collection("participants").updateOne({ name: username }, { $set: { lastStatus: Date.now() } })
        return res.sendStatus(200)
    } else {
        return res.sendStatus(404)
    }
})

async function removeParticipants() {
    try{
        const participants = await db.collection("participants").find().toArray()
        let status = Date.now()
        for (let i = 0; i < participants.length; i++) {
            if (status - participants[i].lastStatus > 10000){
                await db.collection("participants").deleteOne({name: participants[i].name})
                await db.collection("messages").insertOne(
                    {
                        from: participants[i].name,
                        to: "Todos",
                        text: "sai da sala...",
                        type: "status",
                        time: dayjs().format('HH:mm:ss')
                    }
                )
            }
        }    
    } catch(err){
        console.log(err)
    }
}

setInterval(removeParticipants, 15000)

server.listen(5000, () => {
    console.log("Servidor: http://localhost:5000")
})
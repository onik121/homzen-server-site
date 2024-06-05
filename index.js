require('dotenv').config()
const express = require('express')
const cors = require('cors');
const jwt = require('jsonwebtoken')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const app = express()
const port = process.env.PORT || 5000;

// midleware
app.use(cors());
app.use(express.json())


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@jahid12.81vfswo.mongodb.net/?retryWrites=true&w=majority&appName=jahid12`;
// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});


const verifyToken = (req, res, next) => {
    // console.log('inside verify token', req.headers.authorization)
    if (!req.headers.authorization) {
        return res.status(401).send({ message: 'unauthorized access' })
    }
    const token = req.headers.authorization.split(' ')[1];
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).send({ message: 'unauthorized access' })
        }
        req.decoded = decoded;
        next();
    })
};


async function run() {
    try {

        // mongodb collection
        const usersCollection = client.db("homzen").collection("users")
        const propertiesCollection = client.db("homzen").collection("properties");
        const wishListCollection = client.db("homzen").collection("wishlist");


        // jwt
        app.post('/jwt', async (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' })
            res.send({ token })
        })



        // properties related api
        app.get('/properties', async (req, res) => {
            const result = await propertiesCollection.find().toArray()
            res.send(result);
        })
        app.get('/properties/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await propertiesCollection.findOne(query)
            res.send(result)
        })


        // user related api
        app.get('/users/role/:email', verifyToken, async (req, res) => {
            const email = req.params.email;
            if (email !== req.decoded.email) {
                return res.status(403).send({ message: 'Forbidden access' });
            }
            const query = { email: email };
            const user = await usersCollection.findOne(query);
            let role = 'none';
            if (user) {
                if (user.role === 'admin') {
                    role = 'admin';
                } else if (user.role === 'agent') {
                    role = 'agent';
                }
            }
            res.send({ role });
        });
        app.post('/users', async (req, res) => {
            const user = req.body;
            const query = { email: user.email };
            const existingUser = await usersCollection.findOne(query)
            if (existingUser) {
                return res.send({ message: 'user alredy exists', insertedId: null })
            }
            const result = await usersCollection.insertOne(user)
            res.send(result)
        })


        // wishList related api
        app.get('/wishlist/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email: email }
            const result = await wishListCollection.find(query).toArray();
            res.send(result)
        })
        app.post('/wishlist', async (req, res) => {
            const item = req.body;
            const query = { propertyId: item.propertyId };
            const existinItem = await wishListCollection.findOne(query)
            if (existinItem) {
                return res.send({ message: 'Item alredy exists', insertedId: null })
            }
            const result = await wishListCollection.insertOne(item)
            res.send(result)
        })
        app.delete('/wishlist/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await wishListCollection.deleteOne(query)
            res.send(result);
        })

        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    }
    finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);



app.get('/', (req, res) => {
    res.send('Hello World!')
})

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})
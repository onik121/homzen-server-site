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
        const offersCollection = client.db("homzen").collection("offers");
        const reviewsCollection = client.db("homzen").collection("reviews");

        // admin
        const verifyAdmin = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email };
            const user = await usersCollection.findOne(query)
            const isAdmin = user?.role === 'admin';
            if (!isAdmin) {
                return res.status(403).send({ message: 'forbidden access' })
            }
            next();
        }
        // agent
        const verifyAgent = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email };
            const user = await usersCollection.findOne(query)
            const isAgent = user?.role === 'agent';
            if (!isAgent) {
                return res.status(403).send({ message: 'forbidden access' })
            }
            next();
        }


        // jwt
        app.post('/jwt', async (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' })
            res.send({ token })
        })



        // properties related api
        app.get('/properties', async (req, res) => {
            const query = {verification_status: 'verified'}
            const result = await propertiesCollection.find(query).sort({ created_at: -1 }).toArray();
            res.send(result);
        })
        // admin
        app.get('/properties/all', async (req, res) => {
            const result = await propertiesCollection.find().sort({ created_at: -1 }).toArray();
            res.send(result);
        })
        app.get('/properties/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await propertiesCollection.findOne(query)
            res.send(result)
        })
        // agent
        app.get('/properties/agent/:email', async (req, res) => {
            const email = req.params.email;
            const query = { agent_email: email }
            const result = await propertiesCollection.find(query).sort({ created_at: -1 }).toArray();
            res.send(result)
        })
        app.post('/properties', async (req, res) => {
            const data = req.body;
            const result = await propertiesCollection.insertOne(data)
            res.send(result)
        })
        // admin
        app.patch('/property/verification-status/:id', async (req, res) => {
            const item = req.body;
            const filter = { _id: new ObjectId(item.id) };
            const updateVerificationStatus = {
                $set: { verification_status: item.action },
            };
            const result = await propertiesCollection.updateOne(filter, updateVerificationStatus);
            res.send(result)
        })
        // agent
        app.delete('/properties/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await propertiesCollection.deleteOne(query)
            res.send(result)
        })
        // agent
        app.patch('/properties/:id', async (req, res) => {
            const id = req.params.id;
            const data = req.body;
            const filter = { _id: new ObjectId(id) };
            const options = { upsert: true };
            const updateCoffe = {
                $set: {
                    property_title: data.property_title,
                    property_location: data.property_location,
                    price: data.price,
                    apartment_type: data.apartment_type,
                    bedrooms: data.bedrooms,
                    area: data.area,
                    washrooms: data.washrooms,
                    garages: data.garages,
                    land_size: data.land_size,
                    built_year: data.built_year,
                    property_status: data.property_status,
                    description: data.description,
                    property_image: data.property_image,
                },
            };
            const result = await propertiesCollection.updateOne(filter, updateCoffe, options);
            res.send(result)
        })



        // user related api
        app.get('/users/admin', verifyToken, verifyAdmin, async (req, res) => {
            const result = await usersCollection.find().toArray()
            res.send(result);
        })
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
        app.patch('/user/status/:id', verifyToken, verifyAdmin, async (req, res) => {
            const item = req.body;
            console.log(item)
            const offerId = new ObjectId(item.id);
            const filter = { _id: offerId };
            const updateSelectedOffer = {
                $set: { role: item.action },
            };
            const result = await usersCollection.updateOne(filter, updateSelectedOffer);
            if (item.action === 'fraud') {
                await propertiesCollection.deleteMany({ agent_email: item.email });
            }
            res.send(result);
        })
        app.delete('/user/:id', async (req, res) => {
            const id = req.params.id;
            const query = {_id: new ObjectId(id)}
            const result = await usersCollection.deleteOne(query)
            res.send(result);
        })



        // wishList related api
        app.get('/wishlist/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email: email }
            const result = await wishListCollection.find(query).sort({ created_at: -1 }).toArray();
            res.send(result)
        })
        app.get('/wishlist/id/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await wishListCollection.findOne(query)
            res.send(result)
        })
        app.post('/wishlist', async (req, res) => {
            const item = req.body;
            const query = { propertyId: item.propertyId, email: item.email };
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


        //  property offers related api
        app.get('/offer/agent/:email', async (req, res) => {
            const agentEmail = req.params.email;
            const query = { agent_email: agentEmail }
            const result = await offersCollection.find(query).toArray()
            res.send(result);
        })
        app.get('/offer/:email', async (req, res) => {
            const email = req.params.email;
            const query = { buyerEmail: email }
            const result = await offersCollection.find(query).toArray()
            res.send(result);
        })
        app.post('/offer', async (req, res) => {
            const item = req.body;
            const query = { propertyId: item.propertyId, buyerEmail: item.buyerEmail };
            const existinOffer = await offersCollection.findOne(query)
            if (existinOffer) {
                return res.send({ message: 'Item alredy exists', insertedId: null })
            }
            const result = await offersCollection.insertOne(item)
            res.send(result)
        })
        app.patch('/offer/status/:id', async (req, res) => {
            const item = req.body;
            // console.log(item)
            const offerId = new ObjectId(item.id);
            const filter = { _id: offerId };
            const updateSelectedOffer = {
                $set: { status: item.action },
            };

            const result = await offersCollection.updateOne(filter, updateSelectedOffer);
            if (item.action === 'accept') {
                const offer = await offersCollection.findOne({ _id: offerId });
                const propertyId = offer.propertyId;
                const updateOtherOffers = {
                    $set: { status: 'reject' },
                };
                const otherOffersFilter = {
                    propertyId: propertyId,
                    _id: { $ne: offerId },
                };
                await offersCollection.updateMany(otherOffersFilter, updateOtherOffers);
                await wishListCollection.deleteOne({ propertyId: item.propertyId });
            }
            res.send(result);
        });
        app.delete('/offer/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await offersCollection.deleteOne(query)
            res.send(result)
        })




        // reviews
        app.get('/reviews', async (req, res) => {
            const result = await reviewsCollection.find().sort({ created_at: -1 }).toArray();
            res.send(result);
        })
        app.get('/reviews/:id', async (req, res) => {
            const id = req.params.id;
            const query = { propertyId: id }
            const result = await reviewsCollection.find(query).sort({ created_at: -1 }).toArray();
            res.send(result)
        })
        app.get('/reviews/email/:email', async (req, res) => {
            const email = req.params.email;
            const query = { reviewer_email: email }
            const result = await reviewsCollection.find(query).sort({ created_at: -1 }).toArray();
            res.send(result)
        })
        app.post('/reviews', async (req, res) => {
            const data = req.body
            const result = await reviewsCollection.insertOne(data)
            res.send(result)
        })
        app.delete('/reviews/:id', async (req, res) => {
            const id = req.params.id;
            console.log(id)
            const query = { _id: new ObjectId(id) }
            const result = await reviewsCollection.deleteOne(query)
            res.send(result)
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
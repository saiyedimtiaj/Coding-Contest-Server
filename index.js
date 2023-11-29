const express = require("express");
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const cors = require("cors");
const app = express();
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const stripe = require('stripe')(process.env.PAYMENT_SECRET_KEY)

app.use(
  cors({
    origin: ["http://localhost:5173","https://bespoke-brioche-882f5f.netlify.app"],
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());
const port = process.env.PORT || 5000;

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.xslrw3a.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

const verifyUser = async (req, res, next) => {
  const token = req.cookies?.token;
  if (!token) {
    return res.status(401).send({ message: "unauthoridze Access" });
  }
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).send({ message: "Forviden Access" });
    }
    req.decoded = decoded;
    next();
  });
};

const verifyAdmin = async (req, res, next) => {
  const email = req.decoded.email;
  const query = { email: email };
  const user = await userColluction.findOne(query);
  const isAdmin = user?.role === "admin";
  if (!isAdmin) {
    return res.status(403).send({ message: "forbidden access" });
  }
  next();
};

const verifyCreator = async (req, res, next) => {
  const email = req.decoded.email;
  const query = { email: email };
  const user = await userColluction.findOne(query);
  const isCreator = user?.role === "creator";
  if (!isCreator) {
    return res.status(403).send({ message: "forbidden access" });
  }
  next();
};

async function run() {
  try {

    const courseColluction = client.db("course-contest").collection("courses");
    const userColluction = client.db("course-contest").collection("user");
    const bookingsColluction = client.db("course-contest").collection("booking");
    const winnerColluction = client.db("course-contest").collection("winner");

    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "10d",
      });
      res
        .cookie("token", token, {
          httpOnly: true,
          secure: true,
          sameSite: "none",
        })
        .send({ message: "sucess" });
    });

    app.post("/logout", async (req, res) => {
      res.clearCookie("token", { maxAge: 0 }).send({ message: true });
    });

    app.post("/courses", async (req, res) => {
      const body = req.body;
      const result = await courseColluction.insertOne(body);
      res.send(result);
    });

    app.get("/courses", async (req, res) => {
      const sortObj = {};
      const catObj = {};
      const nameObj = {};
      const sortBy = req.query.sortby;
      const limit = parseInt(req.query?.limit);
      if (sortBy) {
        sortObj[sortBy] = "desc";
      }
      const category = req.query?.category;
      if (category) {
        catObj.category = category;
      }
      const result = await courseColluction
        .find(catObj)
        .sort(sortObj)
        .limit(limit)
        .toArray();
      res.send(result);
    });

    app.get("/courses/:id",verifyUser, async (req, res) => {
      const id = req.params?.id;
      const query = { _id: new ObjectId(id) };
      const result = await courseColluction.findOne(query);
      res.send(result);
    });

    app.get("/creatorCourses", async (req, res) => {
      const email = req.query?.email;
      const query = { creatorEmail: email };
      const result = await courseColluction.find(query).toArray();
      res.send(result);
    });

    app.get("/course-search", async (req, res) => {
      const search = req.query.search;
      const result = await courseColluction
        .find({ contestName: { $regex: ".*" + search + ".*", $options: "i" } })
        .toArray();
      res.send(result);
    });

    app.delete("/courses/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await courseColluction.deleteOne(query);
      res.send(result);
    });

    app.put('/courses/:id',async(req,res)=>{
      const id = req.params.id;
      const count = req.body.count
      const filter = {_id: new ObjectId(id)};
      const options = { upsert: true };
      const updateDoc = {
        $set:{
          participationCount : count
        }
      }
      const result = await courseColluction.updateOne(filter,updateDoc,options);
      res.send(result)
    })

    app.post("/users", async (req, res) => {
      const userInfo = req.body;
      const user = { email: userInfo?.email };
      const allUser = await userColluction.findOne(user);
      if (allUser) {
        return res.send({ message: "user already exist", insertedId: null });
      }
      const result = await userColluction.insertOne(userInfo);
      res.send(result);
    });

    app.get('/userCount',async(req,res)=>{
      const total = await userColluction.estimatedDocumentCount();
      res.send({total})
    })

    app.patch("/courses/:id", async (req, res) => {
      const id = req.params?.id;
      const body = req.body
      const query = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const updatedDoc = {
        $set: {
          contestName: body?.contestName,
          category: body?.category,
          image: body?.image,
          description: body?.description,
          dedline: body?.dedline,
          contestPrize: parseInt(body?.contestPrize),
          prizeMoney: parseInt(body?.prizeMoney),
        },
      };
      const result = await courseColluction.updateOne(query,updatedDoc,options)
      res.send(result)
    });

    app.put('/courses-status/:id',async(req,res)=>{
      const id = req.params.id;
      const filter = {_id: new ObjectId(id)};
      const options = { upsert: true };
      const updatedDoc = {
        $set: {
          status:'approved'
        }
      };
      const result = await courseColluction.updateOne(filter,updatedDoc,options)
      res.send(result)
    })

    app.patch('/select-winner/:id',async(req,res)=>{
      const id = req.params.id;
      const filter = {_id: new ObjectId(id)};
      const winnerInfo = req.body;
      const options = { upsert: true };
      const updatedDoc = {
        $set:{
          winnerName:winnerInfo?.name,
          winnerImage:winnerInfo?.userImage,
          winnerStatus: 'selected'
        }
      }
      const result = await courseColluction.updateOne(filter,updatedDoc,options);
      res.send(result)
    })

    app.post('/winners',async(req,res)=>{
      const body = req.body;
      const result = await winnerColluction.insertOne(body)
      res.send(result)
    })

    app.get('/winners',async(req,res)=>{
      const email = req.query.email;
      const query = {winnerEmail:email};
      const result = await winnerColluction.find(query).toArray();
      res.send(result)
    })

    app.get("/users/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const result = await userColluction.findOne(query);
      res.send(result);
    });

    app.get("/users", verifyUser, async (req, res) => {
      const skip = parseInt(req?.query?.skip)
      const limit = parseInt(req?.query?.limit)
      const result = await userColluction.find().skip(skip * limit).limit(limit).toArray();
      res.send(result);
    });

    app.get('/winner-liderboard',async(req,res)=>{
      const result = await winnerColluction.find().sort({ winningPrice : 'desc' }).toArray();
      res.send(result)
    })

    app.patch('/users/:id',async(req,res)=>{
      const id = req.params?.id;
      const filter = {_id: new ObjectId(id)};
      const role = req.body.role;
      const options = { upsert: true };
      const updatedDoc = {
        $set:{
          role:role
        }
      }
      const result = await userColluction.updateOne(filter,updatedDoc,options)
      res.send(result)
    })

    // app.put('/user')

    app.post('/bookings',async(req,res)=>{
      const booking = req.body;
      const result = bookingsColluction.insertOne(booking);
      res.send(result)
    })

    app.get('/bookings',verifyUser,async(req,res)=>{
      const email = req.query.email;
      const filter = {}
      if(req.query.email !== req.decoded.email){
        return res.status(401).send({message:'forviden access'})
      }
      if(req.query?.email){
        filter.email = email
      }
      const result = await bookingsColluction.find(filter).toArray()
      res.send(result)
    })

    app.get('/bookings/:id',async(req,res)=>{
      const id = req.params?.id;
      const query = {contestId:id};
      const result = await bookingsColluction.find(query).toArray()
      res.send(result)
    })

    app.post('/create-payment-intent',async(req,res)=>{
      const {price} = req.body;
      const amount = parseInt(price * 100)

      const paymentIntent = await stripe.paymentIntents.create({
        amount : amount,
        currency:'usd',
        payment_method_types:['card']
      })

      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    })

    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    // console.log(
    //   "Pinged your deployment. You successfully connected to MongoDB!"
    // );
  } finally {
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello, I am future developer");
});

app.listen(port, () => {
  console.log(`coding contest listening on port ${port}`);
});

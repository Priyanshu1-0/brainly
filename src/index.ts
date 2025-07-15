import dotenv from "dotenv";
dotenv.config();
import express from "express";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import z, { email } from "zod";
import bcrypt, { hash } from "bcrypt";
import { ContentModel, UserModel, LinkModel } from "./db";
import {JWT_SECRET} from "./config";
import { userMiddleware } from "./middleware";
import cors from "cors";

const app = express();

app.use(express.json());
app.use(cors());

mongoose.connect(process.env.MONGODB_URL!)
  .then(() => console.log("Connected to Brainly database"))
  .catch((err) => console.error("MongoDB connection error:", err));

app.post("/api/v1/signup", async (req,res)=>{
    const requiredBody = z.object({
        email: z.email().min(3).max(100),
        password: z.string().min(5).max(100)
    })

    const parsedDatawithSuccess = requiredBody.safeParse(req.body)

    if(!parsedDatawithSuccess.success){
        res.json({
            message: "Invalid Format",
            error: parsedDatawithSuccess.error
        })
        return
    }

    let throwError = false
    const {email, password, username} = req.body;
    try{
        const hashedPassword = await bcrypt.hash(password, 5);
        await UserModel.create({
            username: username,
            email: email,
            password: hashedPassword
        })
    }catch(e){
        res.status(403).json({
            message: "User already exists"
        })
        throwError = true;
    }
    if(!throwError){
        res.json({
            message: "Signed up!"
        })
    }
})

app.post("/api/v1/signin", async (req,res)=>{
    const {email, password} = req.body;
    const existingUser = await UserModel.findOne({
        email: email
    })
    if(!existingUser){
        res.status(403).json({
            message: "User does not exist"
        })
        return
    }  
    const passwordMatch = await bcrypt.compare(password, existingUser.password!)
    if(passwordMatch){
        const token = jwt.sign({
            id: existingUser._id
        },JWT_SECRET!)

        res.json({
            token
        })
    }else{
        res.json({
            message: "Password is Incorrect"
        })
    }
})

app.post("/api/v1/content", userMiddleware, async (req,res)=>{
        const link = req.body.link
        const title = req.body.title
        const type = req.body.type;

        await ContentModel.create({
            link,
            title,
            type,
            //@ts-ignore
            userId: req.userId,
            tags: []
        })
        res.json({
            message: "Content Added"
        })
})

app.get("/api/v1/content",userMiddleware, async (req,res)=>{
    //@ts-ignore    
    const userId = req.userId;
    const content = await ContentModel.find({
        userId: userId
    }).populate("userId", "username")
res.json({
    content
})
})

app.delete("/api/v1/content", userMiddleware, async (req,res)=>{
        //@ts-ignore
        const userId = req.userId;
        const contentId = req.body.contentId;
        await ContentModel.deleteOne({
            _id: contentId,
            userId: userId
        })
        res.json({
            message: "Deleted"
        })
})

app.post("/api/v1/brain/share", userMiddleware, async (req,res)=>{
    const { share } = req.body;
    
    if (!share) {
        return res.status(400).json({
            message: "Share parameter is required"
        });
    }
    
    try {
        //@ts-ignore
        const userId = req.userId;
        const hash = `brain-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
        await LinkModel.create({
            hash: hash,
            userId: userId
        });
        res.json({
            link: hash
        });
    } catch (error) {
        res.status(500).json({
            message: "Error creating share link"
        });
    }
})
app.get("/api/v1/brain/:shareLink", async (req,res)=>{
    const { shareLink } = req.params;
    
    try {

        const linkRecord = await LinkModel.findOne({ hash: shareLink });
        
        if (!linkRecord) {
            return res.status(404).json({
                message: "Share link is invalid or sharing is disabled"
            });
        }
        
        const user = await UserModel.findById(linkRecord.userId);
        if (!user) {
            return res.status(404).json({
                message: "User not found"
            });
        }
        
        const content = await ContentModel.find({ userId: linkRecord.userId });
        
        const transformedContent = content.map(item => ({
            id: item._id,
            type: item.type, 
            link: item.link,
            title: item.title,
            tags: item.tags || []
        }));
        
        res.json({
            username: user.username || "Anonymous",
            content: transformedContent
        });
        
    } catch (error) {
        res.status(500).json({
            message: "Error retrieving shared content"
        });
    }
})



app.listen(process.env.PORT, () => console.log("Listening on Port "+process.env.PORT));
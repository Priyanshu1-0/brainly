"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const express_1 = __importDefault(require("express"));
const mongoose_1 = __importDefault(require("mongoose"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const zod_1 = __importDefault(require("zod"));
const bcrypt_1 = __importDefault(require("bcrypt"));
const db_1 = require("./db");
const config_1 = require("./config");
const middleware_1 = require("./middleware");
const app = (0, express_1.default)();
app.use(express_1.default.json());
mongoose_1.default.connect(process.env.MONGODB_URL)
    .then(() => console.log("Connected to Brainly database"))
    .catch((err) => console.error("MongoDB connection error:", err));
app.post("/api/v1/signup", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const requiredBody = zod_1.default.object({
        email: zod_1.default.email().min(3).max(100),
        password: zod_1.default.string().min(5).max(100)
    });
    const parsedDatawithSuccess = requiredBody.safeParse(req.body);
    if (!parsedDatawithSuccess.success) {
        res.json({
            message: "Invalid Format",
            error: parsedDatawithSuccess.error
        });
        return;
    }
    let throwError = false;
    const { email, password, username } = req.body;
    try {
        const hashedPassword = yield bcrypt_1.default.hash(password, 5);
        yield db_1.UserModel.create({
            username: username,
            email: email,
            password: hashedPassword
        });
    }
    catch (e) {
        res.status(403).json({
            message: "User already exists"
        });
        throwError = true;
    }
    if (!throwError) {
        res.json({
            message: "Signed up!"
        });
    }
}));
app.post("/api/v1/signin", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { email, password } = req.body;
    const existingUser = yield db_1.UserModel.findOne({
        email: email
    });
    if (!existingUser) {
        res.status(403).json({
            message: "User does not exist"
        });
        return;
    }
    const passwordMatch = yield bcrypt_1.default.compare(password, existingUser.password);
    if (passwordMatch) {
        const token = jsonwebtoken_1.default.sign({
            id: existingUser._id
        }, config_1.JWT_SECRET);
        res.json({
            token
        });
    }
    else {
        res.json({
            message: "Password is Incorrect"
        });
    }
}));
app.post("/api/v1/content", middleware_1.userMiddleware, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const link = req.body.link;
    const title = req.body.title;
    const type = req.body.type;
    yield db_1.ContentModel.create({
        link,
        title,
        type,
        //@ts-ignore
        userId: req.userId,
        tags: []
    });
    res.json({
        message: "Content Added"
    });
}));
app.get("/api/v1/content", middleware_1.userMiddleware, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    //@ts-ignore    
    const userId = req.userId;
    const content = yield db_1.ContentModel.find({
        userId: userId
    }).populate("userId", "username");
    res.json({
        content
    });
}));
app.delete("/api/v1/content", middleware_1.userMiddleware, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    //@ts-ignore
    const userId = req.userId;
    const contentId = req.body.contentId;
    yield db_1.ContentModel.deleteOne({
        _id: contentId,
        userId: userId
    });
    res.json({
        message: "Deleted"
    });
}));
app.post("/api/v1/brain/share", middleware_1.userMiddleware, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
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
        yield db_1.LinkModel.create({
            hash: hash,
            userId: userId
        });
        res.json({
            link: hash
        });
    }
    catch (error) {
        res.status(500).json({
            message: "Error creating share link"
        });
    }
}));
app.get("/api/v1/brain/:shareLink", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { shareLink } = req.params;
    try {
        const linkRecord = yield db_1.LinkModel.findOne({ hash: shareLink });
        if (!linkRecord) {
            return res.status(404).json({
                message: "Share link is invalid or sharing is disabled"
            });
        }
        const user = yield db_1.UserModel.findById(linkRecord.userId);
        if (!user) {
            return res.status(404).json({
                message: "User not found"
            });
        }
        const content = yield db_1.ContentModel.find({ userId: linkRecord.userId });
        const transformedContent = content.map(item => ({
            id: item._id,
            type: "link",
            link: item.link,
            title: item.title,
            tags: item.tags || []
        }));
        res.json({
            username: user.username || "Anonymous",
            content: transformedContent
        });
    }
    catch (error) {
        res.status(500).json({
            message: "Error retrieving shared content"
        });
    }
}));
app.listen(process.env.PORT, () => console.log("Listening on Port " + process.env.PORT));

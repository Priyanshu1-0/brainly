import mongoose, {Schema, model} from "mongoose";

const UserSchema = new Schema({
    username: String,
    email: {type: String, unique: true},
    password: String
})

export const UserModel = model("Users", UserSchema);

const ContentSchema = new Schema({
    type: String,
    title: String,
    link: String,
    tags: [{type: mongoose.Types.ObjectId, ref: "Tag"}],
    userId: {type: mongoose.Types.ObjectId, required: true, ref: "Users"}
})

export const ContentModel = model("Content", ContentSchema)

const LinkSchema = new Schema({
    hash: { type: String, required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'Users', required: true },
});

export const LinkModel = model("Link", LinkSchema)
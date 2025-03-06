const mongoose= require("mongoose");

const connectDB= async() =>{
    try{
        mongoose.connect(process.env.MONGO_URI)
        .then(() => console.log("MongoDB Connected"))
        .catch((err) => console.log(err));
    }catch(err){
        console.log({message: "Error", error: err.message});
    }
}

module.exports= { connectDB };
const express = require('express')
const path = require('path')
const {open} = require('sqlite')
const sqlite3 = require('sqlite3')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const cors = require('cors')


const app = express()
const dbPath = path.join(__dirname,"TodoList.db")

let db = null 
app.use(express.json())
app.use(cors())

const initializeAndStartServer = async ()=> {
    try{
        db = await open({
            filename: dbPath,
            driver: sqlite3.Database
        })
        app.listen(3000, ()=> console.log("Server Running at http://localhost:3001")) 
       }
catch(err){
    console.log(`DB Error: ${err.message}`);
    process.exit(1)
}
}

initializeAndStartServer();

app.get("/user", async (req,res) => {
    const getQuery = `SELECT * FROM user`;
    const getlist = await db.all(getQuery)
    res.send(getlist)
})

/////////////////////REGESTRATION////////////////////////////////////////////////
app.post('/register',async (req,res) => {
    const {username,email,password} = req.body;
    const  getUserQuery = `SELECT * FROM user WHERE username = "${username}" OR email = "${email}"`;
    const getUser = await db.all(getUserQuery)
    if(getUser.length === 0){
        const hashedPassword = await bcrypt.hash(password,8);
        const createUserQuery = `INSERT INTO user (username,email,password)
        VALUES ("${username}", "${email}", "${hashedPassword}")`
        await db.run(createUserQuery)
        res.send({
            message: 'Registration Successfull. Login to continue',
            type: 'success'
        })
    }
    else{
        if(getUser[0].username === username && getUser[0].email === email){
            res.status(400)
            res.send({
                message: 'Username & Email Id already exists',
                type: 'error'
            })
        }
        else if(getUser[0].email === email){
            res.status(400)
            res.send({
                message: 'Email Id already exists',
                type: 'error'
            })
        }
        else if(getUser[0].username === username){
            res.status(400)
            res.send({
                message: 'Username already exists',
                type: 'error'
            })
        }
    }
})

//////////////////////////////////////////LOGIN/////////////////////////////////
app.post('/login', async (req,res) => {
    console.log(req.body)
    const {username,password} = req.body
   
    const  getUserQuery = `SELECT * FROM user WHERE username = "${username}"`;
    const getUser = await db.get(getUserQuery)
    if (getUser !== undefined){
        const isPasswordMatched = await bcrypt.compare(password,getUser.password)
        if (isPasswordMatched){
            const payload = {username}
            const jwtToken = jwt.sign(payload,'todo_token')
            res.send({jwtToken})
        }
        else{
            res.status(400)
            res.send({
                message: 'Invalid Password',
                type: 'error'
        })
        }
    }else{
        res.status(400)
        res.send({
            message: 'Invalid Username',
            type: 'error'
        })
    }
    
})
/////////////////////////////////////////MIDDLEWARE//////////////////////////////
const authorization = (req,res,next) => {
    let jwtToken;
    const authHead = req.headers["authorization"]
   
    if (authHead !== undefined){
        jwtToken = authHead.split(' ')[1]
    }
   
    if(jwtToken === undefined){
        res.status(401)
        res.send("No Access Token")
    }
    else{
        jwt.verify(jwtToken,"todo_token", async (error,payload) => {
            if (error){
                res.status(401)
                res.send("Invalid Access Token")
            }
            else{
                req.userData = payload
                next();
            }
        })
    }
}

/////////////////////////////////////////RETRIVE-TODO//////////////////////////////////
app.get("/", authorization , async (req,res)=> {
    const {username} = req.userData
    const getTodoQuery = `SELECT * FROM todo WHERE username="${username}" `
    const getTodo = await db.all(getTodoQuery)
    res.send(getTodo)
})

/////////////////////////////////////////CREATE-TODO//////////////////////////////////
app.post("/", authorization , async (req,res)=> {
    const {username} = req.userData
    const {id,status,item} = req.body 
    
    const createTodoQuery = `INSERT INTO todo (id,username,item,status) 
    VALUES ("${id}","${username}","${item}","${status}")`
    await db.run(createTodoQuery)
    res.send("Todo Created")
})

/////////////////////////////////////////MODIFY-TODO//////////////////////////////////
app.put("/", authorization , async (req,res)=> {
    const {id,status} = req.body 
    const modifyTodoQuery = `UPDATE todo SET status="${status}" WHERE id="${id}"`
    await db.run(modifyTodoQuery)
    res.send("Todo Status Updated")
})

/////////////////////////////////////////DELETE-TODO//////////////////////////////////
app.delete("/:id", authorization , async (req,res)=> {
    const {id} = req.params 
    const deleteTodoQuery = `DELETE FROM todo WHERE id="${id}"`
    await db.run(deleteTodoQuery)
    res.send("Todo DELETED")
})

module.exports = app 
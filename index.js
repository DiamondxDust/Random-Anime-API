import express from "express";
import axios from "axios";
import bodyParser from "body-parser";
import pg from "pg";
import * as af from "./functions.js";
import bcrypt from "bcrypt";
import passport from "passport";
import { Strategy } from "passport-local";
import session from "express-session";
import env from "dotenv";

const app = express();
const port = 3000;
const API_URL = "https://kitsu.io/api/edge/";
const saltRounds = 10;
env.config();

app.use(
    session({
        secret: process.env.SESSION_SECRET,
        resave: false,
        saveUninitialized: true,
        cookie: {
            maxAge: 1000 * 60 * 60 * 24,
        }
    })
);

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

app.use(passport.initialize());
app.use(passport.session({

}));

const db = new pg.Client({
    user: process.env.PG_USER,
    host: process.env.PG_HOST,
    database: process.env.PG_DATABASE,
    password: process.env.PG_PASSWORD,
    port: process.env.PG_PORT,
});


db.connect();

//Need to initialize the array that stores the random retrieved three anime here for use in the addanime post route.
// Array is emptied each time the /search post route is called.
let randomAnime = [];


app.get("/", async (req,res) => {
    const genreList = await af.getGenres();
    if (req.isAuthenticated()){
        const currentUser = req.user;
        res.render("index.ejs", {genres: genreList, currentUser: currentUser})
    } else {
        res.render("index.ejs", { genres: genreList });
    }
});

app.get("/signup", (req, res) => {
    res.render("signup.ejs");
});

app.post("/signup", async (req, res) => {
    const email = req.body.username;
    const password = req.body.password;
    const password2 = req.body.password2;

    if (password === password2){
        try {
            const checkResult = await db.query(
                "select * from users where email = $1",
                [email]
            );
            if (checkResult.rows.length > 0){
                const error = "User already exists! Please log in!"
                res.render("login.ejs", {error: error});
            } else {
                bcrypt.hash(password, saltRounds, async (err, hash) => {
                    if (err) {
                        console.log("Error hashing password", err);
                    } else {
                        const result = await db.query(
                            "insert into users (email, password) values ($1, $2) returning *",
                            [email, hash]
                        );
                        const user = result.rows[0];
                        req.login(user, (err) => {
                            console.log("success");
                            console.log(user);
                            res.redirect("/");
                        })
                    }
                })
            }
        } catch (err) {
            console.log(err);
        };
    } else {
        const error = "Passwords do not match!";
        res.render("signup.ejs", {error: error})
    }
})

app.get("/login", (req, res) => {
    if (req.isAuthenticated()){
        res.redirect("/viewlist");
    } else {
        res.render("login.ejs");
    }
});

app.get("/logout", (req, res) => {
    req.logout(function (err) {
        if (err){
            return next(err);
        }
        res.redirect("/");
    });
});

app.post("/login",
    passport.authenticate("local", {
        successRedirect: "/",
        failureRedirect: "/login",
    })
);

app.get("/viewlist", async (req,res) => {
    if (req.isAuthenticated()){
        const currentUser = req.user;
        const userGenreList = await af.getUserGenres(currentUser.id);
        if (userGenreList) {
            const list = await af.getUserList(currentUser.id);
            res.render("user_list.ejs", {list:list, user: currentUser, genres: userGenreList});
        } else {
            res.render("user_list.ejs", {user: currentUser})
        }
    } else {
        const error = "Please log in first!";
        res.render("login.ejs", {error: error});
    }
});

app.post("/", async (req,res) => {
    randomAnime = [];
    const genreList = await af.getGenres();
    const genre = req.body.genre;
    const ageRating = req.body.ageRating;
    const status = req.body.status;
    let fullAnimeList = [];
    let query = `anime?filter[categories]=${genre}`;

    if (ageRating) {
        if (status) {
            query = query.concat(`&filter[ageRating]=${ageRating}&filter[status]=${status}`);
        } else {
            query = query.concat(`&filter[ageRating]=${ageRating}`);
        }
    } else if (status) {
        query = query.concat(`&filter[status]=${status}`);
    }

    try {
        const response = await axios.get(API_URL + query);
        
        if (response.data.meta.count > 0) {
            const lastLink = response.data.links.last;
            const splitLink = lastLink.split("&");
            const numLinks = Number(splitLink[splitLink.length - 2].split("page%5Bnumber%5D=")[1])
            const pageLinkBase = lastLink.split("&page")[0];

            for (let i = 1; i < numLinks + 1; i++){
                let link = pageLinkBase.concat(`&page%5Bnumber%5D=${i}&page%5Bsize%5D=10`)
                let result = await axios.get(link);
                let list = result.data.data;
                list.forEach((x) => {
                    fullAnimeList.push(x);
                })
            }
            
            //Generate three random, unique indices from the filtered anime array and push three results into the randomAnime array to pass to ejs.
            const randomIndices = af.generateRandomIndices(fullAnimeList.length);
            randomAnime.push(fullAnimeList[randomIndices[0]], fullAnimeList[randomIndices[1]], fullAnimeList[randomIndices[2]]);

            if (req.isAuthenticated()){
                const currentUser = req.user;
                res.render("index.ejs", {genres: genreList, currentUser: currentUser, data: randomAnime})
            } else {
                res.render("index.ejs", { genres: genreList, data: randomAnime});
            }
        } else {
            const message = `There were ${response.data.meta.count} results for the filters selected.`
            if (req.isAuthenticated()){
                const currentUser = req.user;
                res.render("index.ejs", {genres: genreList, currentUser: currentUser, error: message})
            } else {
                res.render("index.ejs", { genres: genreList, error: message})
            }
        }
        
    } catch (error) {
        console.log(error);
        res.redirect("/");
    }
});

app.post("/viewlist/filter", async (req, res) => {
    const genreChoice = (req.body.genre).toLowerCase();
    const currentUser = req.user;
    const userGenreList = await af.getUserGenres(currentUser.id);
    const list = await af.getFilteredUserList(currentUser.id, genreChoice);
    res.render("user_list.ejs", {list:list, user: currentUser, genres: userGenreList});
});


app.post("/addanime", async (req, res) => {
    const currentUser = req.user;
    const genreList = await af.getGenres();
    const animeURL = req.body.addanime;
    const response = await axios.get(animeURL);
    const data = response.data.data.attributes;
    const genreLink = response.data.data.relationships.genres.links.related;
    let genreArr = [];
    const genreResponse = await axios.get(genreLink);
    const genreData = genreResponse.data.data;
    const apiId = response.data.data.id;
    const synopsis = data.synopsis;
    const startDate = data.createdAt.split('T')[0];
    const status = data.status;
    const imageURL = data.posterImage.original;

    let title = data.titles.en || data.titles.en_jp || data.titles.en_us || data.titles.ja_jp;

    genreData.forEach((e) => {
        genreArr.push(e.attributes.name);
    });
    const newAnimeGenres = genreArr.join("; ");
    const chosen = randomAnime.find((anime) => anime.id === apiId);
    const index = randomAnime.indexOf(chosen);

    try {
        await db.query(
            "insert into anime_list (userid, title, synopsis, startDate, status, imageUrl, genres, apiId) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
            [currentUser.id, title, synopsis, startDate, status, imageURL, newAnimeGenres, apiId]
        );
        randomAnime.splice(index, 1);
        res.render("index.ejs", {genres: genreList, currentUser: currentUser, data: randomAnime})
    } catch (err){
        console.log(err);
        res.redirect("/");
    }
});

app.post("/removeanime", async (req, res) => {
    const id = req.body.removeanime;
    try {
    await db.query(
        "DELETE FROM anime_list where id = $1",
        [id]
        );
    } catch (err){
        console.log(err);
    }
    res.redirect("/viewlist");
});

passport.use(
    "local",
    new Strategy(async function verify(username, password, cb) {
        try {
            const result = await db.query(
                "select * from users where email = $1",
                [username]
            );
            if (result.rows.length > 0) {
                const user = result.rows[0];
                const storedHashedPassword = user.password;
                bcrypt.compare(password, storedHashedPassword, (err, valid) => {
                    if (err) {
                        console.error("Error comparing passwords:", err);
                        return cb(err);
                    } else {
                        if (valid) {
                            return cb(null, user);
                        } else {
                            return cb(null, false);
                        }
                    }
                });
            } else {
                return cb("User not found!");
            }
        } catch (err){
            console.log(err);
        };
    })
);

passport.serializeUser((user, cb) => {
    cb(null, user);
});

passport.deserializeUser((user, cb) => {
    cb(null, user);
});

app.listen(port, () => {
    console.log(`Listening on http://localhost:${port}.`)
});
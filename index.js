import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import bcrypt from "bcrypt";
import passport from "passport";
import { Strategy } from "passport-local";
import session from "express-session";
import env from "dotenv";
import GoogleStrategy from 'passport-google-oauth2';
import RedisStore from "connect-redis"
import { createClient } from "redis"

const app = express();
const port = process.env.PORT || 4000;
const saltRounds = 10;
let redisClient = createClient({
  url: 'redis://red-cpppf26ehbks73c6hgrg:6379',
});
redisClient.connect().catch(console.error);
let redisStore = new RedisStore({
  client: redisClient,
  prefix: "myapp:",
});
env.config();

const db = new pg.Client({
    user: process.env.PGUSER,
    host: process.env.PGHOST,
    database: process.env.PGDB,
    password: process.env.PGPASSWORD,
    port: process.env.PGPORT,
});
db.connect();

app.use(
    session({
        store: redisStore,
        secret: process.env.SESSION_SECRET,
        resave: false,
        saveUninitialized: false,
        cookie: {
        secure: false, // if true only transmit cookie over https
        httpOnly: false, // if true prevent client side JS from reading the cookie 
        maxAge: 1000 * 60 * 10 // session max age in miliseconds
    }
    })
);
/*app.use(session({
cookie:{
    secure: true,
    maxAge:60000
       },
secret: 'secret',
saveUninitialized: true,
resave: false
}));*/

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));
app.use(passport.initialize());
app.use(passport.session());



//get home page
app.get("/", async (req, res) => {
    res.render("main.ejs");
});


app.get("/secrets", async (req, res) => {
    console.log(req.user);
    if (req.isAuthenticated()) {
        const data = await db.query("select * from parking where vehicle_no is not null order by sr_no");
        if (data.rows[0] != undefined) {
            res.render('index.ejs', {
                getData: data,
            });
        }else{
        res.redirect("/login");
        }
    } else {
        res.redirect("/login");
    }
});

app.get("/about", (req, res) => {
    res.render("about.ejs");
});
app.get("/contact", (req, res) => {
    res.render("contact.ejs");
});
app.get("/register", (req, res) => {
    res.render("register.ejs");
});
app.get("/login", (req, res) => {
    res.render("login.ejs");
});



//form entry allots new parkings

app.post("/allot", async (req, res) => {
    const ow_name = req.body.name.toUpperCase();
    const veh_no = req.body.vehicle_no.toUpperCase();
    const veh_name = req.body.company.toUpperCase();
    const checkEmptyParking = await db.query("select sr_no from parking where vehicle_no is null");
    let empty_parkings = [];
    checkEmptyParking.rows.forEach((parking) => {
        empty_parkings.push(parking.sr_no);
    });
    empty_parkings.sort((a, b) => a - b);
    if (ow_name != '' && veh_no != '' && veh_name != '') {
        if (empty_parkings[0] != undefined) {
            const checkVehNo = await db.query("select vehicle_no from parking where vehicle_no is not null");
            let vehNos = [];
            checkVehNo.rows.forEach((vehno) => {
                vehNos.push(vehno.vehicle_no);
            });
            let count = 0;
            for (let i = 0; i < vehNos.length; i++) {
                const element = vehNos[i];
                if (element == veh_no) {
                    count++;
                }
            }
            if (count == 0) {
                const year = new Date().getFullYear();
                const month = new Date().getMonth() + 1;
                const day = new Date().getDate();
                const date = String(year) + "-" + String(month) + "-" + String(day);
                const pkng_no = await db.query(
                    "update parking set owner_name=$1,vehicle_no=$2,vehicle_company=$3,entry_date=$4 where sr_no=$5 returning parking_no",
                    [ow_name, veh_no, veh_name, date, empty_parkings[0]]
                );
                let strm = "Parking " + String(pkng_no.rows[0].parking_no) + " alloted successfully";
                const data = await db.query("select * from parking where vehicle_no is not null order by sr_no");
                res.render("index.ejs", { entryMessage: strm, getData: data, });
            }
            else {
                console.log("There is same Vehicle exist");
                const data = await db.query("select * from parking where vehicle_no is not null order by sr_no");
                res.render("index.ejs", { entryMessage: "There is same vehicle exist.", getData: data, });
            }
        }
        else {
            console.log("There is no Parking Available")
            const data = await db.query("select * from parking where vehicle_no is not null order by sr_no");
            res.render("index.ejs", { entryMessage: "Parking space not available.", getData: data, });
        }
    }
    else {
        console.log("Please fill all the fields");
        const data = await db.query("select * from parking where vehicle_no is not null order by sr_no");
        if (data.rows[0] != undefined) {
            res.render("index.ejs", { entryMessage: "Please fill all fields.", getData: data, });
        }
        else {
            res.render("index.ejs", { entryMessage: "Please fill all fields.", });
        }
    }
});




//delete a parking
app.post("/dlt", async (req, res) => {
    const parking_no_dlt = req.body.parking_no;
    if (parking_no_dlt == '') {
        console.log('Error');
    }
    else {
        await db.query(
            "update parking set owner_name=NULL,vehicle_no=NULL,vehicle_company=NULL,entry_date=NULL where parking_no=$1",
            [parking_no_dlt]);
        console.log("parking deleted successfully.")
        const data = await db.query("select * from parking where vehicle_no is not null order by sr_no");
        if (data.rows[0] != undefined) {
            res.render("index.ejs", { deleteMessage: "Parking deleted successfully", getData: data, });
        }
        else {
            res.render("index.ejs", { deleteMessage: "Parking deleted successfully", });
        }
    }
});


//edit screen
let pkno = '';
app.post("/edit", async (req, res) => {
    const parking_no_edit = req.body.parking_no;
    pkno = parking_no_edit;
    const data = await db.query("select * from parking where parking_no = $1", [parking_no_edit]);
    res.render("edit.ejs", {
        editData: data,
    });
});
app.post("/edit_enter", async (req, res) => {
    const data = await db.query("select * from parking where parking_no = $1", [pkno]);
    const ow_name = req.body.name.toUpperCase();
    const veh_no = req.body.vehicle_no.toUpperCase();
    const veh_name = req.body.company.toUpperCase();
    const checkVehNo = await db.query("select vehicle_no from parking where vehicle_no is not null");
    const popVehNo = await db.query("select vehicle_no from parking where parking_no=$1", [pkno]);
    let vehNos = [];
    checkVehNo.rows.forEach((vehno) => {
        vehNos.push(vehno.vehicle_no);
    });
    for (let i = 0; i < vehNos.length; i++) {
        if (vehNos[i] == popVehNo.rows[0].vehicle_no) {
            vehNos.splice(i, 1);
        }
    }
    let count = 0;
    for (let i = 0; i < vehNos.length; i++) {
        const element = vehNos[i];
        if (element == veh_no) {
            count++;
        }
    }
    if (count == 0) {
        await db.query("update parking set owner_name=$1,vehicle_no=$2,vehicle_company=$3 where parking_no=$4",
            [ow_name, veh_no, veh_name, pkno]
        );
        res.redirect("/");
    }
    else if (res.status = 703) {
        res.render("edit.ejs", {
            editData: data,
            getError: "Same Vehicle exist.",
        });
    }
});

//search bar 
app.post("/search", async (req, res) => {
    const searchContent = req.body.search_box.toUpperCase();
    if (searchContent != '') {
        const getCarNoArray = await db.query("select * from parking where parking is not null")
        let CarNoArray = [];
        let PkngNoArray = [];
        getCarNoArray.rows.forEach((carno) => {
            CarNoArray.push(carno.vehicle_no);
        });
        getCarNoArray.rows.forEach((carno) => {
            PkngNoArray.push(carno.parking_no);
        });
        for (let i = 0; i < CarNoArray.length; i++) {
            const element = CarNoArray[i];
            if (searchContent == element) {
                const data = await db.query("select * from parking where vehicle_no=$1", [searchContent]);
                res.render("index.ejs", {
                    getData: data,
                });
                break;
            }
        }
        for (let i = 0; i < PkngNoArray.length; i++) {
            const element = PkngNoArray[i];
            if (searchContent.toLowerCase() == element) {
                const data = await db.query("select * from parking where parking_no=$1", [searchContent.toLowerCase()]);
                res.render("index.ejs", {
                    getData: data,
                });
                break;
            }
        }
    }else{
        res.redirect("/");
    }

});








app.get("/auth/google", passport.authenticate("google", {
  scope: ["profile", "email"],
}));

app.get("/auth/google/secrets", passport.authenticate("google", {
  successRedirect: "/secrets",
  failureRedirect: "/login",
}));


app.post(
  "/login",
  passport.authenticate("local", {
    successRedirect: "/secrets",
    failureRedirect: "/login",
  })
);

app.post("/register", async (req, res) => {
  const email = req.body.username;
  const password = req.body.password;

  try {
    const checkResult = await db.query("SELECT * FROM users WHERE email = $1", [
      email,
    ]);

    if (checkResult.rows.length > 0) {
      req.redirect("/login");
    } else {
      bcrypt.hash(password, saltRounds, async (err, hash) => {
        if (err) {
          console.error("Error hashing password:", err);
        } else {
          const result = await db.query(
            "INSERT INTO users (email, password) VALUES ($1, $2) RETURNING *",
            [email, hash]
          );
          const user = result.rows[0];
          req.login(user, (err) => {
            console.log("success");
            res.redirect("/secrets");
          });
        }
      });
    }
  } catch (err) {
    console.log(err);
  }
});

passport.use("local",
  new Strategy(async function verify(username, password, cb) {
    try {
      const result = await db.query("SELECT * FROM users WHERE email = $1 ", [
        username,
      ]);
      if (result.rows.length > 0) {
        const user = result.rows[0];
        const storedHashedPassword = user.password;
        bcrypt.compare(password, storedHashedPassword, (err, valid) => {
          if (err) {
            //Error with password check
            console.error("Error comparing passwords:", err);
            return cb(err);
          } else {
            if (valid) {
              //Passed password check
              return cb(null, user);
            } else {
              //Did not pass password check
              return cb(null, false);
            }
          }
        });
      } else {
        return cb("User not found");
      }
    } catch (err) {
      console.log(err);
    }
  })
);

passport.use("google", new GoogleStrategy(
  {
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: "http://localhost:3000/auth/google/secrets",
    userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo",
  }, async (accessToken, refreshToken, profile, cb) => {
    try {
      const result = await db.query("select * from users where email=$1",[profile.email]);
      if (result.rows.length===0) {
        const newUser=await db.query("insert into users(email,password) values($1,$2)",[profile.email,"google"]);
        cb(null,newUser.rows[0]);
      }
      else{
        cb(null,result.rows[0]);
      }
    } catch (error) {
      cb(err);
    }
  })
);

passport.serializeUser((user, cb) => {
  cb(null, user);
});
passport.deserializeUser((user, cb) => {
  cb(null, user);
});


app.listen(port, () => {
    console.log(`Listening on port ${port}`);
});



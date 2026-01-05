import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import bcrypt from "bcrypt";
import passport from "passport";
import { Strategy } from "passport-local";
import session from "express-session";
import env from "dotenv";
import nodemailer from 'nodemailer';
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
    ssl: {
      rejectUnauthorized: true, 
      ca: "MIIEUDCCArigAwIBAgIUPdabppFdnPBRZkBYnqpPXfBkmGwwDQYJKoZIhvcNAQEMBQAwQDE+MDwGA1UEAww1YzQzYTIzYzktY2RmYi00ZWY2LWFmODgtZWYzNjM5NjcwOWRiIEdFTiAxIFByb2plY3QgQ0EwHhcNMjYwMTA1MTAyMTA4WhcNMzYwMTAzMTAyMTA4WjBAMT4wPAYDVQQDDDVjNDNhMjNjOS1jZGZiLTRlZjYtYWY4OC1lZjM2Mzk2NzA5ZGIgR0VOIDEgUHJvamVjdCBDQTCCAaIwDQYJKoZIhvcNAQEBBQADggGPADCCAYoCggGBAMcnqUpIpavNFbj5jrzuptL4LUAzuR0DMrNDDJzb875UybDQEE0YBv/HglLBXu/Tdf67ztukreyRKeskfidGKhvDSyY/6dhjfLiT0w6E3pL+XAgPC3QZTJ3pLg4owQ1RYfJiwx2UgbnPdxlqlTdDnvekbozyQMiuwLot09Hs6sgBUBvxFx7EOg3fwrk12nnLHhMHPMoSL9XbOVs/K5PvnND3DcpT/3rBKJRaenPTlBQJdmERTPhR0RBljen92MyS45CdcRJlR0gCkmC6NpAXCoOutMw9cm/4L77poZicIHcyStRY9T56W0/wDqfinx+3/3syhEYA7ZM0GW+yPgkK9W//N+WNjpBRji0SE1T8K1Nk+tLgsB8ahoWzdfx6kMGEWEZij3Lh3dWnje6JqNquDeQjA8vvjnWbvVrpPgIlIhf5H/4M8k6+hVFFnK/NfnX6RRIHOJGsgcX4kbMDBCHeusX85x9ePnkpLAoVwyezc37xPn2kDD5R1OVerVFIHPXqtQIDAQABo0IwQDAdBgNVHQ4EFgQUeF4H865VCajSa9QV2xhIAq+CCkYwEgYDVR0TAQH/BAgwBgEB/wIBADALBgNVHQ8EBAMCAQYwDQYJKoZIhvcNAQEMBQADggGBAH9clatTXHOH4O3/X9E5G4Ztxg6M9Y/TwSulFWwr+pU/C1idQGamsUhX6SqLKKC4UtwAiQwSzx8dDGAGxdcmf5tZPb2IqRP47LZv9ZlPp2RCv+ue7bXrRkSMpNdf2dqim1CdFMr5h3rBC5Q8O+YPXSl6gHWq2YPYXuktGBoV+2/A3zBZkPjwducoKHFi8rsiTOKAOUH8iX5Dx+ig1mlqAlXTFpAXxbe7NQb9Le7pswxAg/0eNntA4cyQjwLe9ym49S+Tyocg9r/FXuYtuZrKOvk44cRQ8mCt80q5+pmGzw9yrr0yFUGcGuJ3V9W1p2B46Qe7iKmHfAlb7LBpgXmtQezT3RsmRSgq0CgC7mGNRLQ6Joxp1SSlV9epHZS7EdRnaRrYhnMVQqTDj/tsG2kyyNowN36NhFg7VX8sbzcOZPCtTAWCsXx5K16RlLzohRwaNDcVHP6FyQAeZm5/mNqXwU2X32/dAbctGt4fXd0Qj2VnGDhwLWHbPHewhhajO7bT2Q==",
    },
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

app.get("/parking", async (req, res) => {
  const parking_no = await db.query("select parking_no from parking where vehicle_no is not null");
  const pkArray = [];
  for (let i = 0; i < parking_no.rows.length; i++) {
    pkArray.push(parking_no.rows[i].parking_no);
  }
  console.log(pkArray);
  res.render("parking.ejs", {
    pkno: pkArray,
  });
});
app.get("/secrets", async (req, res) => {
  console.log(req.isAuthenticated());
  const check = await req.isAuthenticated();
  if (check) {
    const data = await db.query("select * from parking where vehicle_no is not null order by sr_no");
    if (data.rows[0] != undefined) {
      res.render('index.ejs', {
        getData: data,
      });
    } else {
      res.redirect("/login");
    }
  } else {
    res.redirect("/login");
  }
});

app.get("/contact-main", (req, res) => {
  res.render("main_contact.ejs");
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
  const category = req.body.category.toUpperCase();

  if (ow_name != '' && veh_no != '' && veh_name != '' && category != "") {
    if (category == "BIKE") {
      const checkEmptyParking = await db.query("select sr_no from parking where vehicle_no is null and parking_no like 'b%'");
      let empty_parkings = [];
      checkEmptyParking.rows.forEach((parking) => {
        empty_parkings.push(parking.sr_no);
      });
      empty_parkings.sort((a, b) => a - b);
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
          const date = String(day) + "-" + String(month) + "-" + String(year);
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
    } else if (category == "CAR") {
      const checkEmptyParking = await db.query("select sr_no from parking where vehicle_no is null and parking_no like 'c%'");
      let empty_parkings = [];
      checkEmptyParking.rows.forEach((parking) => {
        empty_parkings.push(parking.sr_no);
      });
      empty_parkings.sort((a, b) => a - b);
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
}
);





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
    res.redirect("/secrets");
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
  } else {
    res.redirect("/secrets");
  }

});

app.get("/logout", (req, res) => {
  res.render("main.ejs");
});


app.post("/contact-submit", (req, res) => {
  const name = req.body.name;
  const email = req.body.email;
  const text = req.body.text;
  var transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: 'lakshay.jangra.394@gmail.com',
      pass: 'cfaprmptfpvzdffd'
    }
  });
  var mailOptions = {
    from: 'Lakshay Solutions <no-reply@company.com>',
    to: email,
    subject: '@no_reply_mail',
    html: '<h1>Thanks,<br>' + name + '<br>for contacting us, we will get back to you as soon as possible.</h1>'
  };
  var mailOptions1 = {
    from: 'Lakshay Solutions <no-reply@company.com>',
    to: 'jangralakshay611@gmail.com',
    subject: 'A person contact us on Lakshay Solutions.',
    html: '<h1>Email:<br>' + email + '<br>Text:<br>' + text + '</h1>',
  };
  if (name.length != 0 && email.length != 0) {
    transporter.sendMail(mailOptions, function (error, info) {
      if (error) {
        console.log(error);
      } else {
        console.log('Email sent: ' + info.response);
      }
    });
    transporter.sendMail(mailOptions1, function (error, info) {
      if (error) {
        console.log(error);
      } else {
        console.log('Email sent: ' + info.response);
      }
    });
    res.redirect("/contact-main");
  }
  else{
    res.send("Please fill all the fields");
  } 
})
app.post("/contact-submitin", (req, res) => {
  const name = req.body.name;
  const email = req.body.email;
  const text = req.body.text;
  var transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: 'lakshay.jangra.394@gmail.com',
      pass: 'cfaprmptfpvzdffd'
    }
  });
  var mailOptions = {
    from: 'Lakshay Solutions <no-reply@company.com>',
    to: email,
    subject: '@no_reply_mail',
    html: '<h1>Thanks,<br>' + name + '<br>for contacting us, we will get back to you as soon as possible.</h1>'
  };
  var mailOptions1 = {
    from: 'Lakshay Solutions <no-reply@company.com>',
    to: 'jangralakshay611@gmail.com',
    subject: 'A person contact us on Lakshay Solutions.',
    html: '<h1>Email:<br>' + email + '<br>Text:<br>' + text + '</h1>',
  };
  if (name.length != 0 && email.length != 0) {
    transporter.sendMail(mailOptions, function (error, info) {
      if (error) {
        console.log(error);
      } else {
        console.log('Email sent: ' + info.response);
      }
    });
    transporter.sendMail(mailOptions1, function (error, info) {
      if (error) {
        console.log(error);
      } else {
        console.log('Email sent: ' + info.response);
      }
    });
    res.redirect("/contact");
  }
  else{
    res.send("Please fill all the fields");
  } 
})











app.get(
  "/auth/google",
  passport.authenticate("google", {
    scope: ["profile", "email"],
  })
);

app.get(
  "/auth/google/secrets",
  passport.authenticate("google", {
    successRedirect: "/secrets",
    failureRedirect: "/login",
  })
);

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
      res.redirect("/login");
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
            res.redirect("/login");
          });
        }
      });
    }
  } catch (err) {
    console.log(err);
  }
});

passport.use(
  "local",
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
        return cb("User not found");
      }
    } catch (err) {
      console.log(err);
    }
  })
);

passport.use(
  "google",
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: "https://parking-system-yoyu.onrender.com/auth/google/secrets",
      userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo",
    },
    async (accessToken, refreshToken, profile, cb) => {
      try {
        await console.log(profile);
        const result = await db.query("SELECT * FROM users WHERE email = $1", [
          profile.email,
        ]);
        if (result.rows.length === 0) {
          const newUser = await db.query(
            "INSERT INTO users (email, password) VALUES ($1, $2)",
            [profile.email, "google"]
          );
          return cb(null, newUser.rows[0]);
        } else {
          return cb(null, result.rows[0]);
        }
      } catch (err) {
        return cb(err);
      }
    }
  )
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






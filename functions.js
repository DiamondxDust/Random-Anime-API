import pg from "pg";
import env from "dotenv";

const db = new pg.Client({
    user: process.env.PG_USER,
    host: process.env.PG_HOST,
    database: process.env.PG_DATABASE,
    password: process.env.PG_PASSWORD,
    port: process.env.PG_PORT,
  });
  db.connect();

export function sayHi(){
    const result = "Say hi";
    return result;
};

export async function getGenres(){
    const result = await db.query(
        "select title, slug from genres order by title asc"
    );
    const items = result.rows;
    return items;
}

export async function checkUsers(){
  const result = await db.query(
    "SELECT * from users order by id asc"
  );
  const items = result.rows;
  return items;
}

export async function getCurrentUser(id){
  let result = await db.query(
    "select * from users where id = $1", [id]
  );
  let user = result.rows[0];
  return user;
}

export async function getUserList(id){
    let result = await db.query(
        "select * from anime_list where userid = $1 order by title asc",
        [id]
    );
    if (result.rows.length > 0){
        let list = result.rows;
        return list;
    } else {
        return;
    }
}

export async function getFilteredUserList(id, filter){
    let result = await db.query(
        "select * from anime_list where userid = $1 and LOWER(genres) like '%' || $2 || '%' order by title asc",
        [id, filter]
    );
    let list = result.rows;
    return list;
}

export async function getUserGenres(id){
    const result = await db.query(
        "select array_agg(genres order by genres asc) from anime_list where userid = $1",
        [id]
    );
    if (result.rows[0].array_agg) {
        const agg_array = result.rows[0].array_agg;
        const array = agg_array.join(";").split(";");
        const trimmedArray = array.map(e => e.trim());
        const uniqueArray = [...new Set(trimmedArray)];
        return uniqueArray;
    } else {
        return;
    }
}

export function generateRandomIndices(arrayLength){
    const indices = new Set();
    while (indices.size < 3){
        const randomIndex = Math.floor(Math.random() * arrayLength);
        indices.add(randomIndex);
    };
    return Array.from(indices);
}
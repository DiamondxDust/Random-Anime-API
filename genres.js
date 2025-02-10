//Used to import genre list into local database from API
import axios from "axios";
import * as fs from "fs";

const API_URL = "https://kitsu.io/api/edge/";
const categoryLinkBase = "https://kitsu.io/api/edge/categories/";

let genres = [];

const categoryLastLink = (await axios.get(API_URL + "categories")).data.links.last;
const categoryLastPage = (await axios.get(categoryLastLink)).data.data;
const numIds = Number(categoryLastPage[categoryLastPage.length - 1].id);

for (let i=1; i <= numIds; i++){
    try {
        let category = (await axios.get(categoryLinkBase + i)).data.data;
        let obj = {
            title: category.attributes.title,
            slug: category.attributes.slug,
        };
        genres.push(obj);
    } catch (error) {
};
}

const csvString = [
    [
        "title",
        "slug"
    ],
    ...genres.map(item => [
        item.title,
        item.slug
    ])
].map(e => e.join(",")).join("\n")

fs.writeFile('anime_genres.csv', csvString, 'utf8', function (err) {
    if (err) {
      console.log('Some error occured - file either not saved or corrupted file saved.');
    } else{
      console.log('It\'s saved!');
    }
  });
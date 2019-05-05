
class Card {
  constructor(r,s){
    this.rank = r;
    this.suit = s;
  }
}

class Shuffler {
  
  // take a deck of 52 unique cards and return them shuffled, in a different order
  shuffleDeck(cards) {
    const shuffled = [];
    while(cards.length){
      const rand = Math.floor(Math.random()*cards.length);
      shuffled.push(cards.splice(rand,1)); // splice call is not performant
    }
    return shuffled;
  }
}


const s = new Shuffler();

console.log(s.shuffleDeck([new Card(12,'Spades'), new Card(13,'Hearts'), new Card(1,'Clubs'), new Card(3,'Diamonds')]))
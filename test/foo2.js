/*
Suppose we have some input data describing a graph of relationships between parents and children over multiple generations. The data is formatted as a list of (parent, child) pairs, where each individual is assigned a unique integer identifier.

For example, in this diagram, 3 is a child of 1 and 2, and 5 is a child of 4:

1   2   4
 \ /   / \
  3   5   8
   \ / \   \
    6   7   10

parentChildPairs = [
    (1, 3), (2, 3), (3, 6), (5, 6),
    (5, 7), (4, 5), (4, 8), (8, 10)
]

Write a function that takes the graph, as well as two of the individuals in our dataset, as its inputs and returns true if and only if they share at least one ancestor.

Sample input and output:

hasCommonAncestor(parentChildPairs, 3, 8) => false
hasCommonAncestor(parentChildPairs, 5, 8) => true
hasCommonAncestor(parentChildPairs, 6, 8) => true
hasCommonAncestor(parentChildPairs, 1, 3) => false


*/
let parentChildPairs = [
  [1, 3], [2, 3], [3, 6], [5, 6],
  [5, 7], [4, 5], [4, 8], [8, 10]
];


const hasCommonAncestor = (parentChildPairs, x, y) => {
  
  const fakeParent = {};
  const set = new Set();
  
  let xNode = null;
  let yNode = null;
  
  for (let v of parentChildPairs) {
    
    if (!set.has(v[0])) {
      set.add({children: [], left: null, right: null});
    }
    
    {
      const node = set.get(v[0]);
      node.children.push(v[1]);
    }
    
    if (!set.has(v[1])) {
      set.add({children: [], left: null, right: null});
    }
    
    {
      const node = set.get(v[1]);
      if (!node.left) {
        node.left = set.get(v[0]);
      } else {
        node.right = set.get(v[0]);
      }
    }
    
    
    if (!xNode && v[0] === x) {
      xNode = set.get(v[0]);
    }
    
    
    if (!yNode && v[0] === y) {
      yNode = set.get(v[0]);
    }
    
    if (!xNode && v[1] === x) {
      xNode = set.get(v[1]);
    }
    
    
    if (!yNode && v[1] === y) {
      yNode = set.get(v[1]);
    }
    
    
  }
  
  
  if (!(xNode && yNode)) {
    throw 'could not find the nodes for x and y';
  }
  
  
};


console.log(hasCommonAncestor(parentChildPairs));

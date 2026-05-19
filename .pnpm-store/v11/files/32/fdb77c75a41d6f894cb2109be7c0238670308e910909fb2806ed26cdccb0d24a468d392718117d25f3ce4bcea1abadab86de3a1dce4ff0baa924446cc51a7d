
## Some important notes on using bash for entry points to command line tools

#### here is the main reason we use bash as an intermediary

>
> https://stackoverflow.com/questions/50616253/how-to-resolve-chicken-egg-situation-with-tsc-and-npm-install
>


##### we use this bash file instead of a dist/.js file, because of this problem:

```bash
dir_name="$(dirname "$0")"
read_link="$(readlink "$0")";
exec_dir="$(dirname $(dirname "$read_link"))";
my_path="$dir_name/$exec_dir";
basic_path="$(cd $(dirname ${my_path}) && pwd)/$(basename ${my_path})"
js="$basic_path/dist/cli.js"
```


##### there is an extradinary amount of magic required to get a bash script
##### to properly reference an adjacent .js file
##### if the above can be simplified, please lmk, but the above is currently very necessary.

##### one value add here of using a bash script, is that we can easily install any missing CLI dependencies
##### or set env variables as needed

##### run this mofo

```bash
node "$js" "$@"
```

# Dall-E Game made using Python, Express, and Couchbase

## What is the game

Like the Jackbox game series the main game is shown on a TV and players can connect via a mobile device on their web browser. Players are shown pre-generated AI generated image, and asked to guess the prompt used to generate it. All prompts, including the real one, are then shown, and players get points if they can guess the correct prompt or if theirs is guessed. 

## How to install and run



## Challenges with making the game

When the players submit a name or answer to the server, the website then needs to keep pinging the server so it can find out when the state of the game has updated. I initially did this by refreshing the page constantly but this is a bad method. I have come up with a better solution here https://github.com/BabarKhanDev/web-post-request-test and here https://github.com/BabarKhanDev/flaskwaituntilreadytemplate in express and flask respectively.

## How I would improve it

1. Implement the post request solution listed above
2. The game is run using python and then the website is hosted using node. Both could have been run with one python or node script, making it easier to run
3. Improve the graphics, I think the beige is pretty drab
4. Add some sounds, its pretty boring without any

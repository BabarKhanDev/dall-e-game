from datetime import timedelta
import time
import os
import random

# needed for any cluster connection
from couchbase.auth import PasswordAuthenticator
from couchbase.cluster import Cluster
# needed for options -- cluster, timeout, SQL++ (N1QL) query, etc.
from couchbase.options import (ClusterOptions, QueryOptions)
from couchbase.exceptions import CouchbaseException
import couchbase.subdocument as SD

#Start of Constants
ROUND_LENGTH = 120
#End of Constants

def get_cluster(username, password):
    # Connect options
    auth = PasswordAuthenticator(
        username,
        password
    )

    # Get a reference to our cluster
    cluster = Cluster('couchbase://localhost', ClusterOptions(auth))

    # Wait until the cluster is ready for use.
    cluster.wait_until_ready(timedelta(seconds=5))

    return cluster

def get_bucket(cluster, bucket_name):
    # get a reference to our bucket
    cb = cluster.bucket(bucket_name)

    # Get a reference to the default collection, required for older Couchbase server versions
    cb_coll_default = cb.default_collection()
    
    return cb_coll_default

def upsert_document(bucket, key, doc):
    try:
        result = bucket.upsert(key, doc)
    except Exception as e:
        print(e)

def get_document(bucket, key):
    try:
        result = bucket.get(key)
    except Exception as e:
        print(e)

    return result

def get_all_bucket_docs(cluster, bucket):

    try:
        result = cluster.query(
            "SELECT username FROM `"+bucket+"`", QueryOptions(metrics=True))

    except CouchbaseException as ex:
        import traceback
        traceback.print_exc()

    return result

def get_game_stage(game_data_bucket):

    result = get_document(game_data_bucket,"game-state")
    return result.value["round"] , result.value["stage"]

def upsert_state(game_data_bucket, key, value):

    game_data_bucket.mutate_in("game-state", [SD.upsert(key, value)])

def wait_for_usernames(cluster, user_bucket_name, game_data_bucket, num_users):
    
    complete = False
    while not complete:

        input("\nPlease enter any key once all users have entered")

        #list all usernames
        user_docs = get_all_bucket_docs(cluster, user_bucket_name)

        print("\nusers:")
        for row in user_docs.rows():
            print(row["username"])
            num_users += 1


        #ask if this is correct
        confirmed = False
        while not confirmed:
            answer = input("\nAre you sure that this is everyone? (Y/N)\n")
            if (answer == "N" or answer == 'n'):
                confirmed = True
            elif (answer == "Y" or answer == 'y'):
                upsert_state(game_data_bucket,"stage", 1)
                return num_users
            else:
                print("not valid")

def check_if_all_inputted_prompts(game_data_bucket, num_users):

    user_prompts = get_document(game_data_bucket, "user_prompts").value

    return True if (len(user_prompts) == num_users) else False

def update_game_timer(game_data_bucket, time_remaining):
    game_data_bucket.mutate_in("game-state", [SD.upsert('time_to_next_round', time_remaining)])

def wait_for_inputs(game_data_bucket, num_users):
    timer = 0
    while timer <ROUND_LENGTH:
        time.sleep(1)
        update_game_timer(game_data_bucket, (ROUND_LENGTH-timer))
        print(f"time left to write prompts: {ROUND_LENGTH - timer}s ", end= '\r')
        timer += 1

        if (check_if_all_inputted_prompts(game_data_bucket, num_users)):
            print("")
            print("All users have inputted prompts")
            return

def wait_for_prompt_guess(game_data_bucket, num_users):

    timer = 0
    while timer < (ROUND_LENGTH/2) :
        time.sleep(1)
        update_game_timer(game_data_bucket, (ROUND_LENGTH-timer))
        print(f"time left to make choice: {(ROUND_LENGTH/2) - timer}s ", end= '\r')
        timer += 1

        #escape the while loop early if all users have made their choices
        user_choices = get_document(game_data_bucket, "user_prompt_choices").value

        if (len(user_choices) == num_users):
            print("All users have made a choice")
            return

def wait_for_stage_update(game_data_bucket, current_stage):

    wait = True
    while wait:
        time.sleep(0.1)

        _ , stage = get_game_stage(game_data_bucket)
        if (stage != current_stage):
            wait = False 

def run_stage_one(images, game_data_bucket, num_users):

    #upload the image to the database
    random_index = random.randint(0,len(images)-1)
    current_image = images[random_index]
    images = images[slice(0, random_index)] + images[slice(random_index+1,len(images))]
    upsert_state(game_data_bucket, "current_image", current_image)

    wait_for_inputs(game_data_bucket, num_users)

    #Update the game to stage 2
    upsert_state(game_data_bucket, "stage", 2)

    return images

def run_stage_two(game_data_bucket, num_users):

    #wait for users to pick a prompt that they think is real
    wait_for_prompt_guess(game_data_bucket, num_users)

    #show users the correct answer
    upsert_state(game_data_bucket, "stage", 3)

    return

def run_stage_four(game_data_bucket, round):

    round += 1
    upsert_state(game_data_bucket, "round", round)
    if round == 5:
        #three rounds of the game have been played, send the users to the end screen
        upsert_state(game_data_bucket, "stage", 5)  
    else:
        upsert_state(game_data_bucket, "current_image", "")
        upsert_document(game_data_bucket, "user_prompts", {})
        upsert_document(game_data_bucket, "user_prompt_choices", {})
        upsert_state(game_data_bucket, "stage", 1)


def game():
    cluster = get_cluster("Administrator", "password")

    user_bucket = get_bucket(cluster, "users")
    game_data_bucket = get_bucket(cluster, "game-data")

    #generate a list of all possible images
    path = os.path.join(os.getcwd(),"images")
    images = os.listdir(path)

    #basic variable setup
    num_users = 0
    upsert_state(game_data_bucket, "stage", 0)
    upsert_state(game_data_bucket, "round", 0)
    update_game_timer(game_data_bucket, 120)
    upsert_state(game_data_bucket, "current_image", "")
    upsert_document(game_data_bucket, "user_prompts", {})
    upsert_document(game_data_bucket, "user_prompt_choices", {})
    bucket_manager = cluster.buckets()
    bucket_manager.flush_bucket("users")

    game_loop = True
    while game_loop:
        time.sleep(1)

        round , stage = get_game_stage(game_data_bucket)

        if (stage == 0):
            print ("Current stage: username input")
            num_users = wait_for_usernames(cluster, "users", game_data_bucket, num_users)
        elif (stage == 1):
            print (f"Current stage: prompt input\nround:{round+1}")
            images = run_stage_one(images, game_data_bucket, num_users)
        elif (stage == 2):
            print (f"Current stage: reveal correct prompt\nround:{round+1}")
            run_stage_two(game_data_bucket, num_users)
        elif (stage == 3):
            print (f"Current stage: show user score as of round:{round+1}")
            #node.js should update this when it has finished showing the leaderboard
            time.sleep(19)
            upsert_state(game_data_bucket, "stage", 4)
        elif (stage == 4):
            print ("Current stage: determine how many rounds have happened")
            run_stage_four(game_data_bucket, round)
        elif (stage == 5):
            print ("Current stage: showing the final leaderboard")
            answered = False
            while (not answered):
                restartGame = input("would you like to play again? (Y/N)")
                if (restartGame == 'Y' or restartGame == 'y'):
                    game()
                    answered = True
                else:
                    print("Thank you for playing!")
                    answered = True
                    exit()
        else:
            print (f"There has been an error, current stage,round is {stage},{round}")

game()
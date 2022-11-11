
function shuffle_dict(dic){
    dic_keys=Object.keys(dic)
    dic_keys.sort(()=> Math.random()-0.5)

    output = {}
    for(i=0; i<dic_keys.length; i++){
        output[dic_keys[i]] = dic[dic_keys[i]]
    }

    return output
}

let my_dictionary = {"a":1, "b":2, "c":3,"d":4,"e":5,"f":6}
my_dictionary= shuffle_dict(my_dictionary)
console.log(my_dictionary)
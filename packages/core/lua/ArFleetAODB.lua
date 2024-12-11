local json = require("json")

State = {
    Store = {}
}

function Log(msg)
    print(msg)
end

function Handle(type, fn)
    Handlers.add(
        type,
        Handlers.utils.hasMatchingTag("Action", type),
        function(msg)
            local Data = nil
            local success, res = pcall(json.decode, msg.Data)
            if success then
                Data = res
            else
                -- error, leave it nil
            end
            local Result = fn(msg, Data)
            if Result == nil then
                return
            end
            Handlers.utils.reply(Result)(msg)
        end
    )
end

-- Helper function to get or create a namespace
local function getNamespace(sender)
    if not State.Store[sender] then
        State.Store[sender] = {}
    end
    return State.Store[sender]
end

Handle("Set", function(msg, Data)
    local sender = msg.From
    local key = Data.key
    local value = Data.value

    if not key then
        return json.encode({error = "Key is required"})
    end

    local namespace = getNamespace(sender)
    namespace[key] = value

    return json.encode({success = true})
end)

Handle("Get", function(msg, Data)
    local sender = msg.From
    local key = Data.key

    if not key then
        return json.encode({error = "Key is required"})
    end

    local namespace = getNamespace(sender)
    local value = namespace[key]

    return json.encode({value = value})
end)

Handle("Append", function(msg, Data)
    local sender = msg.From
    local key = Data.key
    local value = Data.value

    if not key or value == nil then
        return json.encode({error = "Key and value are required"})
    end

    local namespace = getNamespace(sender)
    
    if type(namespace[key]) ~= "table" then
        return json.encode({error = "Key is not an array"})
    end

    table.insert(namespace[key], value)

    return json.encode({success = true})
end)

Handle("Delete", function(msg, Data)
    local sender = msg.From
    local key = Data.key

    if not key then
        return json.encode({error = "Key is required"})
    end

    local namespace = getNamespace(sender)
    namespace[key] = nil

    return json.encode({success = true})
end)

Handle("GetAll", function(msg)
    local sender = msg.From
    local namespace = getNamespace(sender)

    return json.encode(namespace)
end)


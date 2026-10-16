use framework "Foundation"
use scripting additions

on canonicalPath(value)
    if value does not start with "/" then set value to POSIX path of value
    return ((current application's NSString's stringWithString:value)'s stringByResolvingSymlinksInPath()) as text
end canonicalPath

on findPresentation(filePath)
    if application id "com.microsoft.Powerpoint" is not running then return missing value
    tell application id "com.microsoft.Powerpoint"
        set presentationList to get presentations
        repeat with p in presentationList
            set presentationPath to current application's NSString's stringWithString:(my canonicalPath(full name of p))
            if (presentationPath's isEqualToString:filePath) as boolean then return contents of p
        end repeat
    end tell
    return missing value
end findPresentation

on run argv
    set requestData to current application's NSData's dataWithContentsOfFile:(item 1 of argv)
    set requestObject to current application's NSJSONSerialization's JSONObjectWithData:requestData options:0 |error|:(missing value)
    set actionName to (requestObject's objectForKey:"action") as text
    set filePath to my canonicalPath((requestObject's objectForKey:"file") as text)
    set timeoutSeconds to (requestObject's objectForKey:"timeoutSeconds") as integer
    with timeout of timeoutSeconds seconds
        set p to my findPresentation(filePath)
        if ((requestObject's objectForKey:"waitForOpen") as boolean) then
            repeat 100 times
                if p is not missing value then exit repeat
                delay 0.1
                set p to my findPresentation(filePath)
            end repeat
        end if
        if actionName is "close" then
            if p is not missing value then
                tell application id "com.microsoft.Powerpoint" to close p saving no
            end if
            return "{\"alive\":false}"
        end if
        if p is missing value then error "指定 PowerPoint 演示文稿未打开"
        if actionName is "export" then
            tell application id "com.microsoft.Powerpoint" to set scratchPath to (POSIX path of (path to temporary items)) & ((requestObject's objectForKey:"scratchName") as text)
            set scratchHfs to (POSIX file scratchPath) as text
            tell application id "com.microsoft.Powerpoint"
                save p in scratchHfs as save as PDF
                set pdfData to read (POSIX file scratchPath) as «class data»
                if ((requestObject's objectForKey:"closeAfter") as boolean) then close p saving no
            end tell
            return pdfData
        end if
        error "不支持的 PowerPoint 操作"
    end timeout
end run

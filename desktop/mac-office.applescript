use framework "Foundation"
use scripting additions

on canonicalPath(value)
    return ((current application's NSString's stringWithString:value)'s stringByResolvingSymlinksInPath()) as text
end canonicalPath

on findDocument(filePath)
    if application id "com.microsoft.Word" is not running then return missing value
    tell application id "com.microsoft.Word"
        set documentList to get documents
        repeat with d in documentList
            set documentPath to current application's NSString's stringWithString:(my canonicalPath(posix full name of d))
            if (documentPath's isEqualToString:filePath) as boolean then return contents of d
        end repeat
    end tell
    return missing value
end findDocument

on jsonText(resultObject)
    set jsonData to current application's NSJSONSerialization's dataWithJSONObject:resultObject options:0 |error|:(missing value)
    return (current application's NSString's alloc()'s initWithData:jsonData encoding:4) as text
end jsonText

on statusObject(d)
    set resultObject to current application's NSMutableDictionary's dictionary()
    resultObject's setObject:(d is not missing value) forKey:"alive"
    if d is not missing value then
        tell application id "com.microsoft.Word" to set isSaved to saved of d
        resultObject's setObject:isSaved forKey:"saved"
    end if
    return resultObject
end statusObject

on readObject(d)
    set resultObject to my statusObject(d)
    tell application id "com.microsoft.Word"
        set r to text object of d
        set bodyText to content of r
        set rangeStart to start of content of r
        set rangeEnd to end of content of r
        set pageCount to compute statistics d statistic statistic pages
    end tell
    resultObject's setObject:bodyText forKey:"text"
    resultObject's setObject:rangeStart forKey:"rangeStart"
    -- Word for Mac emits cell marker U+0007 without consuming a native range unit.
    -- Public coordinates address the UTF-16 text returned to the caller.
    set bodyString to current application's NSString's stringWithString:bodyText
    resultObject's setObject:(bodyString's |length|()) forKey:"rangeEnd"
    resultObject's setObject:rangeEnd forKey:"nativeRangeEnd"
    resultObject's setObject:pageCount forKey:"pages"
    return resultObject
end readObject

on run argv
    set requestData to current application's NSData's dataWithContentsOfFile:(item 1 of argv)
    set requestObject to current application's NSJSONSerialization's JSONObjectWithData:requestData options:0 |error|:(missing value)
    set actionName to (requestObject's objectForKey:"action") as text
    set filePath to my canonicalPath((requestObject's objectForKey:"file") as text)
    set timeoutSeconds to (requestObject's objectForKey:"timeoutSeconds") as integer
    with timeout of timeoutSeconds seconds
        set d to my findDocument(filePath)
        if ((requestObject's objectForKey:"waitForOpen") as boolean) then
            repeat 100 times
                if d is not missing value then exit repeat
                delay 0.1
                set d to my findDocument(filePath)
            end repeat
        end if
        if actionName is "status" then return my jsonText(my statusObject(d))
        if actionName is "close" then
            if d is not missing value then
                tell application id "com.microsoft.Word"
                    if ((requestObject's objectForKey:"save") as boolean) then
                        close d saving yes
                    else
                        close d saving no
                    end if
                end tell
            end if
            return "{\"alive\":false}"
        end if
        if d is missing value then error "指定 Word 文档未打开，请重新打开编辑器" number 1701
        if actionName is "read" then return my jsonText(my readObject(d))
        if actionName is "save" then
            tell application id "com.microsoft.Word" to save d
            return my jsonText(my readObject(d))
        end if
        if actionName is "selection" then
            tell application id "com.microsoft.Word"
                activate object d
                if my canonicalPath(posix full name of active document) is not filePath then error "Word 当前文档不匹配，请重试"
                set selectedText to content of selection
                set selectedStart to selection start of selection
                set selectedEnd to selection end of selection
                set pageNumber to get selection information selection information type active end page number
                set startPrefix to content of (create range d start 0 end selectedStart)
                set endPrefix to content of (create range d start 0 end selectedEnd)
            end tell
            if selectedText is missing value then set selectedText to ""
            if startPrefix is missing value then set startPrefix to ""
            if endPrefix is missing value then set endPrefix to ""
            set startString to current application's NSString's stringWithString:startPrefix
            set endString to current application's NSString's stringWithString:endPrefix
            set resultObject to my statusObject(d)
            resultObject's setObject:selectedText forKey:"text"
            resultObject's setObject:(startString's |length|()) forKey:"start"
            resultObject's setObject:(endString's |length|()) forKey:"end"
            resultObject's setObject:pageNumber forKey:"page"
            return my jsonText(resultObject)
        end if
        if actionName is "replace" then
            set searchText to (requestObject's objectForKey:"search") as text
            set replacementText to (requestObject's objectForKey:"replacement") as text
            tell application id "com.microsoft.Word" to set fullText to content of text object of d
            set fullString to current application's NSString's stringWithString:fullText
            set expectedText to requestObject's objectForKey:"expectedText"
            if expectedText is not missing value then
                if not ((fullString's isEqualToString:expectedText) as boolean) then error "Word 内容已变化，请重新读取并提供当前 revision"
            end if
            set searchString to current application's NSString's stringWithString:searchText
            set searchLength to searchString's |length|() as integer
            set startValue to requestObject's objectForKey:"start"
            if startValue is missing value then
                set matchRange to fullString's rangeOfString:searchText options:2
                set matchStart to matchRange's location as integer
                if matchStart > (fullString's |length|() as integer) then error "原文未找到，请重新读取"
                set tailStart to matchStart + searchLength
                set tailText to fullString's substringFromIndex:tailStart
                if (tailText's containsString:searchText) as boolean then error "原文多处出现，请提供选区 start 或扩大原文范围"
            else
                set matchStart to startValue as integer
            end if
            if matchStart < 0 or matchStart + searchLength > (fullString's |length|() as integer) then error "Word 选区超出范围，请重新读取"
            set markerText to character id 7
            set prefixString to fullString's substringToIndex:matchStart
            set nativePrefix to prefixString's stringByReplacingOccurrencesOfString:markerText withString:""
            set nativeSearch to searchString's stringByReplacingOccurrencesOfString:markerText withString:""
            set nativeStart to nativePrefix's |length|() as integer
            set nativeLength to nativeSearch's |length|() as integer
            tell application id "com.microsoft.Word"
                set r to create range d start nativeStart end (nativeStart + nativeLength)
                set actualText to content of r
            end tell
            set actualString to current application's NSString's stringWithString:actualText
            if not ((actualString's isEqualToString:searchText) as boolean) then error "Word 指定选区的原文已变化，请重新读取"
            tell application id "com.microsoft.Word" to set content of r to replacementText
            return my jsonText(my readObject(d))
        end if
        if actionName is "export" then
            tell application id "com.microsoft.Word"
                set scratchPath to (POSIX path of (path to temporary items)) & ((requestObject's objectForKey:"scratchName") as text)
                save as d file name scratchPath file format format PDF
                set pdfData to read (POSIX file scratchPath) as «class data»
                if ((requestObject's objectForKey:"closeAfter") as boolean) then close d saving no
            end tell
            return pdfData
        end if
        error "不支持的 Word 操作"
    end timeout
end run

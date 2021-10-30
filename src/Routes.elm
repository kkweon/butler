module Routes exposing (Page(..), pageParser)

import Url.Parser exposing (Parser, fragment)


type Page
    = Index
    | Options


pageParser : Parser (Page -> a) a
pageParser =
    let
        fragmentHandler : Maybe String -> Page
        fragmentHandler maybeString =
            case maybeString of
                Nothing ->
                    Index

                Just _ ->
                    Options
    in
    fragment fragmentHandler

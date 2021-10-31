module Pages.Index exposing (..)

import Html exposing (..)
import Html.Attributes exposing (href)


type alias Model =
    ()


init : Model
init =
    ()


view : Model -> Html a
view _ =
    div []
        [ h1 [] [ text "Index" ]
        , p [] [ a [ href "/#options" ] [ text "Goto Options page" ] ]
        ]

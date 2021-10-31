module Pages exposing (..)

import Html exposing (..)
import Pages.Index
import Pages.Options
import Routes exposing (Page)


type PageModel
    = Empty
    | Index Pages.Index.Model
    | Options Pages.Options.Model


pageModelFromPage : Page -> PageModel
pageModelFromPage page_ =
    case page_ of
        Routes.Index ->
            Index Pages.Index.init

        Routes.Options ->
            Options Pages.Options.init


viewPage : PageModel -> Html a
viewPage pageModel =
    case pageModel of
        Empty ->
            div [] [ text "Welcome to the application!" ]

        Index model ->
            Pages.Index.view model

        Options model ->
            Pages.Options.view model

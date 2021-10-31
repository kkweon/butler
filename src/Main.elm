module Main exposing (main)

import Browser
import Browser.Navigation as Nav
import Html exposing (..)
import Html.Attributes exposing (..)
import Pages exposing (PageModel, pageModelFromPage, viewPage)
import Routes exposing (Page(..))
import Url
import Url.Parser


type alias Flag =
    ()


main : Program Flag Model Msg
main =
    Browser.application
        { init = init
        , view = view
        , update = update
        , subscriptions = subscriptions
        , onUrlRequest = UrlRequested
        , onUrlChange = UrlChanged
        }


type alias Model =
    { key : Nav.Key
    , pageModel : PageModel
    }


redirect : Nav.Key -> Url.Url -> Cmd Msg
redirect key url =
    url |> Url.toString |> Nav.pushUrl key


init : Flag -> Url.Url -> Nav.Key -> ( Model, Cmd Msg )
init () url key =
    let
        defaultModel =
            { key = key
            , pageModel = Pages.Empty
            }
    in
    ( defaultModel, redirect key url )


type Msg
    = Msg1
    | Msg2
    | UrlRequested Browser.UrlRequest
    | UrlChanged Url.Url


update : Msg -> Model -> ( Model, Cmd Msg )
update msg model =
    case msg of
        Msg1 ->
            ( model, Cmd.none )

        Msg2 ->
            ( model, Cmd.none )

        UrlRequested urlRequest ->
            case urlRequest of
                Browser.Internal url ->
                    ( model, redirect model.key url )

                Browser.External href ->
                    ( model, Nav.load href )

        UrlChanged url ->
            let
                page =
                    Url.Parser.parse Routes.pageParser url
                        |> Maybe.withDefault Routes.Index
            in
            ( { model | pageModel = pageModelFromPage page }
            , Cmd.none
            )


subscriptions : Model -> Sub Msg
subscriptions _ =
    Sub.none


view : Model -> Browser.Document Msg
view model =
    { title = "Application Title"
    , body =
        [ div []
            [ ul []
                [ li [] [ a [ href "/" ] [ text "Home" ] ]
                , li [] [ a [ href "/#options" ] [ text "Options" ] ]
                ]
            , viewPage model.pageModel
            ]
        ]
    }

module Main exposing (main)

import Browser
import Browser.Navigation as Nav
import Html exposing (..)
import Html.Attributes exposing (..)
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
    , url : Url.Url
    , property : String
    , page : Page
    }


init : Flag -> Url.Url -> Nav.Key -> ( Model, Cmd Msg )
init () url key =
    ( Model key url "modelInitialValue" Index, Cmd.none )


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
                    ( model, Nav.pushUrl model.key (Url.toString url) )

                Browser.External href ->
                    ( model, Nav.load href )

        UrlChanged url ->
            let
                page =
                    let
                        _ =
                            Debug.log "urlChanged" url
                    in
                    Url.Parser.parse Routes.pageParser url
                        |> Maybe.withDefault Index
                        |> Debug.log "page"
            in
            ( { model | page = page }
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
            , viewPage model.page
            ]
        ]
    }


viewPage : Page -> Html Msg
viewPage page =
    case page of
        Index ->
            div []
                [ h1 [] [ text "Index" ] ]

        Options ->
            div [] [ h1 [] [ text "Options" ] ]

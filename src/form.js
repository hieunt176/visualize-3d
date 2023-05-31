import { scale_meter_px, scene } from "./configurations.js";
import Container from "./container.js";
import Pack from "./pack.js";
import Packer from "./packer.js";
import { loadResult, loadPacksInstanced, boxInstances, breakPoints, generatePDF } from "./result_drawer.js";
import Logger from "./logger.js";
import Route from "./routes.js";
import DragSurface from "./dragAndDrop/dragSurface.js";
import { deleteAllPacks } from "./dragAndDrop/dragDropMenu.js";

var routeCreated = false;
var containerCreated = false;
var lastNum;
var index = 0;

//removes the container and the loadedBoxes
function updateScene(type) {
    if (type == "loadedPacks")
        scene.remove(scene.getObjectByName("All_Packs"))

    if (type == "all") {
        scene.remove(scene.getObjectByName("All_Packs"))
        scene.remove(scene.getObjectByName("Full_Container"))
    }

    $("#result").empty();

    $("#result").append(`
    <div class="empty-result">
      Not solved yet
    </div>`)

    $("#files").empty();

    $("#files").append(`
    <div class="empty-result">
      Not solved yet
    </div>`)
}

// take the api url and return the data
async function loadApi(url = "") {
    if (url != "") {
        await fetch(url)
            .then(res => {
                if (res.ok)
                    return res.json()
            })
            .then(data => {
                loadDataFromAPI(data)
            })
            .catch(err => console.log(err));
    }

}

//load the data from the csv file into the container and the packages
function loadDataFromAPI(data) {
    let container = data.container;
    let packages = data.colis;
    let routes = data.routes;

    new Route(routes.length, routes).addOrUpdate();
    console.log(routes.length, routes)
    loadRoutes(routes, "api");
    routeCreated = true

    new Container(container.w, container.h, container.l, container.capacity, container.unloading);
    containerCreated = true;

    packages.map(pack => {
        new Pack(pack.label, pack.w, pack.h, pack.l, pack.q, pack.stackingCapacity, pack.rotations, pack.priority).add();
    });

    let logger = new Logger("Load Data", 0.01);
    logger.dispatchMessage();
}

// from  = api || from = localstorage
function loadRoutes(routes = [], loadFrom) {
    let routesLocalStorage = JSON.parse(localStorage.getItem("routes"));
    let length;

    if (loadFrom == "api" || loadFrom == "csv") {
        length = routes.length
        routes = routes
    }
    else {
        if (routesLocalStorage == null) return;

        length = routesLocalStorage.routeNumber
        routes = routesLocalStorage.routes
    }

    if (length > 0) {
        $("#routesNumber").val(length);
        for (let i = 0; i < length - 1; i++)
            addRouteInputs(i + 1);

        $('.routeFrom').each(function (i) { $(this).val(routes[i].from); });
        $('.routeTo').each(function (i) { $(this).val(routes[i].to); });
        $('.routeType').each(function (i) { $(this).val(routes[i].type); });
    }

}

//add/remove inputs from list of routes
function addRouteInputs() {
    $("#routeInputs").append(`
        <div class="inputs">
            <div>
                <p class="inputLabel">From</p>
                <input type="text" class="input routeFrom" required>
            </div>
            <div>
                <p class="inputLabel">To</p>
                <input type="text" class="input routeTo" required>
            </div>
            <div>
                <p class="inputLabel">Type</p>
                <select class="input routeType" required>
                    <option value="dechargement">D</option>
                    <option value="chargement">C</option>
                    <option value="dechargement">D et C</option>
                </select>
            </div>
        </div>`)
}

//read the csv file
//check if the extention if .csv
function readCsv(e, ext) {
    if ($.inArray(ext, ["csv"]) == -1) {
        showErrorMessage("Please upload a CSV file")
        return false;
    }
    if (e.target.files != undefined) {
        $("#file-chosen").html(e.target.files[0].name)
        var reader = new FileReader();
        reader.onload = function (e) {
            var lines = e.target.result.split('\r\n');
            loadDataFromCsv(lines);
        };
        reader.readAsText(e.target.files.item(0));
    }
    return false;
}

//load the data from the csv file into the container and the packages
function loadDataFromCsv(data) {
    let arrayOfRoutes = [];
    for (let i = 5; i < data.length; i++) {
        if (data[i].length > 0) {
            let line = data[i].split(",");

            if (line[0] == "container") {
                new Container(line[1], line[2], line[3], line[4]);
                containerCreated = true;
            }
            if (line[0] == "colis") {
                let rotations = [];
                for (let j = 8; j <= 10; j++) {
                    console.log(line[j])
                    if (line[j] != undefined)
                        rotations.push(line[j].replace("\"", ''));
                }

                new Pack(line[1], line[2], line[3], line[4], line[5], line[6], [...rotations], line[7]).add();
            }
            if (line[0] == "route") {
                arrayOfRoutes.push({
                    id: line[1],
                    from: line[2],
                    to: line[3],
                    type: line[4]
                })
                routeCreated = true
            }
        }
    }

    new Route(arrayOfRoutes.length, arrayOfRoutes).addOrUpdate();
    loadRoutes(arrayOfRoutes, "csv");
}

// show the error message in the application
function showErrorMessage(msg) {
    $(".error-container").toggleClass("error-container--hidden")
    $("#errorMsg").html(msg)

    setTimeout(() => {
        $(".error-container").toggleClass("error-container--hidden")
    }, 1500)
}

$(document).ready(function () {
    const worker = new Worker('src/worker.js', { type: "module" });

    var container = JSON.parse(localStorage.getItem("container"));
    if (container !== null) {
        $("#containerWidth").val(container.w)
        $("#containerHeight").val(container.h)
        $("#containerLenght").val(container.l)
        $("#containerUnloading").val(container.unloading)
    }

    // create the routes from localstorage
    //check if at least a route is created
    loadRoutes([], "localStorage");

    //routes number incerement and decrement
    $("#routeIncrement").click(function () {
        let currentVal = parseInt($("#routesNumber").val());
        $("#routesNumber").val(currentVal + 1);
        addRouteInputs(currentVal + 1);
    });

    $("#routeDecrement").click(function () {
        let currentVal = parseInt($("#routesNumber").val());
        if (currentVal > 1) {
            $("#routesNumber").val(currentVal - 1);
            $('#routeInputs .inputs').last().remove();
        }
    });

    //submit the routes form to add the route
    $("#routesForm").submit(function (event) {
        event.preventDefault();

        var routeDetails = {};
        var route;

        routeDetails.routesNumber = $("#routesNumber").val();
        routeDetails.from = $('.routeFrom').map(function () { return $(this).val(); }).get();
        routeDetails.to = $('.routeTo').map(function () { return $(this).val(); }).get();
        routeDetails.type = $('.routeType').map(function () { return $(this).val(); }).get();

        routeDetails.routes = [];

        for (let i = 0; i < routeDetails.routesNumber; i++) {
            let r = {
                id: i + 1,
                from: routeDetails.from[i],
                to: routeDetails.to[i],
                type: routeDetails.type[i]
            }
            routeDetails.routes.push(r);
        }

        route = new Route(routeDetails.routesNumber, routeDetails.routes)
        route.addOrUpdate();

        routeCreated = true
    });

    //submit the container form to create the container
    $("#containerForm").submit(function (event) {

        event.preventDefault();
        var containerDimensions = {};

        //read variables from container form
        containerDimensions.w = $("#containerWidth").val();
        containerDimensions.h = $("#containerHeight").val();
        containerDimensions.l = $("#containerLenght").val();
        containerDimensions.capacity = 0;

        //remove all the truck and the packs added
        updateScene("all");

        //create the container
        new Container(containerDimensions.w, containerDimensions.h, containerDimensions.l, containerDimensions.capacity);
        new DragSurface(containerDimensions.w, containerDimensions.h, containerDimensions.l);
        containerCreated = true;
    });

    //submit the packages form to add the packs
    $("#packForm").submit(function (event) {
        event.preventDefault();

        if (!containerCreated) {
            showErrorMessage("please create the container")
            return;
        }

        var packDetails = {};
        var pack;

        packDetails.label = $("#packLabel").val();
        packDetails.w = $("#packWidth").val();
        packDetails.h = $("#packHeight").val();
        packDetails.l = $("#packLenght").val();
        packDetails.q = $("#packQuantity").val();
        packDetails.stack = $("#packStackingCapacity").val();
        packDetails.priority = $("#packPriority").val();

        //rotation
        packDetails.r = ["base"];

        if ($('#rightSide').is(":checked")) {
            packDetails.r.push("right-side")
        }
        if ($('#frontSide').is(":checked")) {
            packDetails.r.push("front-side")
        }

        pack = new Pack(packDetails.label, packDetails.w, packDetails.h, packDetails.l, packDetails.q, packDetails.stack, packDetails.r, packDetails.priority, [])
        pack.add()

        // var packDim = packDetails.w + " , " + packDetails.h + " , " + packDetails.l + " ( " + packDetails.q + " ) ";
        // $("#packageDetails").append('<div class="packInfo"><div>' + packDetails.label + '</div><div class="packInfo-numbers">' + packDim + ' </div></div>');
    });

    //push the packages into the container
    $("#solve").click(function () {
        if (!routeCreated) {
            showErrorMessage("Please add a route")
            return;
        }

        if (!containerCreated) {
            showErrorMessage("Please create the container")
            return;
        }

        if (Pack.allInstances.length == 0) {
            showErrorMessage("Please add some packages")
            return;
        }

        $(".menu").toggleClass("openMenu closeMenu");
        $(".menuIcon").toggleClass("openMenuIcon closeMenu");
        deleteAllPacks();
        Pack.removePacksFromTheScene();
        scene.remove(scene.getObjectByName("sphere"));

        var packer = new Packer("cub");
        var packagesToLoad = packer.initialisePackagesToLoad();
        console.log("packagesToLoad: ", packagesToLoad)
        new Logger("Loading", 0.01).dispatchMessage();

        worker.postMessage([Container.instances, packagesToLoad]);
        $(".packer-loader").toggleClass("packer-loader--hide packer-loader--show")

        worker.onmessage = (msg) => {
            console.log("msg: ", msg)

            new Logger("Loaded (Algorithme)", msg.data.executionTime).dispatchMessage();
            $(".packer-loader").toggleClass("packer-loader--hide packer-loader--show")

            // packer[1] là data đã sắp xếp => chuyển đổi data chỗ này

            loadResult(Pack.allInstances, msg.data.packer[1]);

            // if ($("#loadBoxes").is(":checked")) {
                loadPacksInstanced(msg.data.packer[0], msg.data.packer[1])
                // loadPacks(msg.data.packer[0], msg.data.packer[1]);
                new Logger("Loaded (3D models)", msg.data.executionTime).dispatchMessage();
            // }

            // $("#numberBox").attr("max", msg.data.packer[1].length);
            // $("#numberBox").val(msg.data.packer[1].length);

            // console.log(breakPoints)
            // index = boxInstances.length - 1
            // lastNum = breakPoints.length == 0 ? boxInstances[index - 1].count : breakPoints.reduce((partialSum, a) => partialSum + a.count, 0) + 1;

            // $(".scene-player").removeClass("hidden")
        }
    })

    $("#apii").click(async () => {
        localStorage.removeItem("container");
        localStorage.removeItem("packages");
        localStorage.removeItem("routes");
        Pack.allInstances = [];
        Pack.loadPacks();
        // location.reload();

        const get = await fetch("http://localhost:7000/3d", {
            method: "POST",
            // body: JSON.stringify(  {
            //   "vehicle_code": "EXTERNAL_52_0",
            //   "vehicle_weight": 19100000,
            //   "vehicle_cbm": 39632670,
            //   "total_weight_load": 2654875,
            //   "total_cbm_load": 25819612,
            //   "total_duration": 36534,
            //   "total_distance": 65203,
            //   "total_cost": 2251000,
            //   "main_cost": 1291000,
            //   "additional_cost": 960000,
            //   "total_item_cost": 851948494,
            //   "size": {
            //     "width": 231,
            //     "length": 817,
            //     "height": 210
            //   },
            //   "bounding_box": [750, 230, 209],
            //   "elements": [
            //     {
            //       "location_code": "9511",
            //       "cd_code": "9511",
            //       "distance": 0,
            //       "weight_load": 0,
            //       "cbm_load": 0,
            //       "arrival_time": "2023-05-15 08:00:00",
            //       "leaving_time": "2023-05-15 08:00:00",
            //       "location_type": "STATION",
            //       "items": []
            //     },
            //     {
            //       "location_code": "9511",
            //       "cd_code": "9511",
            //       "distance": 0,
            //       "weight_load": 2654875,
            //       "cbm_load": 25819612,
            //       "arrival_time": "2023-05-15 08:00:00",
            //       "leaving_time": "2023-05-15 09:47:31",
            //       "location_type": "DEPOT",
            //       "items": [
            //         {
            //           "item_code": "75581",
            //           "quantity": 2,
            //           "weight": 58000,
            //           "cbm": 535296,
            //           "size": [
            //             {
            //               "length": 96,
            //               "width": 41,
            //               "height": 68
            //             },
            //             {
            //               "length": 41,
            //               "width": 96,
            //               "height": 68
            //             }
            //           ],
            //           "size_index": [0, 0],
            //           "position": [
            //             {
            //               "x": 546,
            //               "y": 69,
            //               "z": 68
            //             },
            //             {
            //               "x": 546,
            //               "y": 69,
            //               "z": 136
            //             }
            //           ]
            //         },
            //         {
            //           "item_code": "75582",
            //           "quantity": 2,
            //           "weight": 18000,
            //           "cbm": 156950,
            //           "size": [
            //             {
            //               "length": 86,
            //               "width": 36,
            //               "height": 25
            //             },
            //             {
            //               "length": 36,
            //               "width": 86,
            //               "height": 25
            //             }
            //           ],
            //           "size_index": [0, 0],
            //           "position": [
            //             {
            //               "x": 660,
            //               "y": 107,
            //               "z": 180
            //             },
            //             {
            //               "x": 660,
            //               "y": 147,
            //               "z": 120
            //             }
            //           ]
            //         },
            //         {
            //           "item_code": "75628",
            //           "quantity": 1,
            //           "weight": 3000,
            //           "cbm": 25088,
            //           "size": [
            //             {
            //               "length": 28,
            //               "width": 28,
            //               "height": 32
            //             },
            //             {
            //               "length": 28,
            //               "width": 28,
            //               "height": 32
            //             }
            //           ],
            //           "size_index": [1],
            //           "position": [
            //             {
            //               "x": 508,
            //               "y": 0,
            //               "z": 159
            //             }
            //           ]
            //         }
            //       ]
            //     },
            //     {
            //       "location_code": "6000018276",
            //       "cd_code": "NPP Panasonic",
            //       "distance": 44920,
            //       "weight_load": 1972150,
            //       "cbm_load": 18566577,
            //       "arrival_time": "2023-05-15 11:15:19",
            //       "leaving_time": "2023-05-15 13:06:57",
            //       "location_type": "CUSTOMER",
            //       "items": [
            //         {
            //           "item_code": "75581",
            //           "quantity": 2,
            //           "weight": 58000,
            //           "cbm": 535296,
            //           "size": [
            //             {
            //               "length": 96,
            //               "width": 41,
            //               "height": 68
            //             }
            //           ],
            //           "size_index": [],
            //           "position": []
            //         },
            //         {
            //           "item_code": "75582",
            //           "quantity": 2,
            //           "weight": 18000,
            //           "cbm": 156950,
            //           "size": [
            //             {
            //               "length": 86,
            //               "width": 36,
            //               "height": 25
            //             }
            //           ],
            //           "size_index": [],
            //           "position": []
            //         }
            //       ]
            //     },
            //     {
            //       "location_code": "5000003588",
            //       "cd_code": "NPP Panasonic",
            //       "distance": 46387,
            //       "weight_load": 736725,
            //       "cbm_load": 7013951,
            //       "arrival_time": "2023-05-15 14:33:53",
            //       "leaving_time": "2023-05-15 15:14:45",
            //       "location_type": "CUSTOMER",
            //       "items": [
            //         {
            //           "item_code": "75628",
            //           "quantity": 1,
            //           "weight": 3000,
            //           "cbm": 25088,
            //           "size": [
            //             {
            //               "length": 28,
            //               "width": 28,
            //               "height": 32
            //             }
            //           ],
            //           "size_index": [],
            //           "position": []
            //         }
            //       ]
            //     }
            //   ]
            // })
            body: JSON.stringify({
                "vehicle_code": "EXTERNAL_52_0",
                "vehicle_weight": 19100000,
                "vehicle_cbm": 39632670,
                "total_weight_load": 2654875,
                "total_cbm_load": 25819612,
                "total_duration": 36534,
                "total_distance": 65203,
                "total_cost": 2251000,
                "main_cost": 1291000,
                "additional_cost": 960000,
                "total_item_cost": 851948494,
                "size": {
                        "width": 231,
                        "length": 817,
                        "height": 210
                      },
                "bounding_box": [
                  750,
                  230,
                  209
                ],
                "elements": [
                  {
                    "location_code": "9511",
                    "cd_code": "9511",
                    "distance": 0,
                    "weight_load": 0,
                    "cbm_load": 0,
                    "arrival_time": "2023-05-15 08:00:00",
                    "leaving_time": "2023-05-15 08:00:00",
                    "location_type": "STATION",
                    "items": []
                  },
                  {
                    "location_code": "9511",
                    "cd_code": "9511",
                    "distance": 0,
                    "weight_load": 2654875,
                    "cbm_load": 25819612,
                    "arrival_time": "2023-05-15 08:00:00",
                    "leaving_time": "2023-05-15 09:47:31",
                    "location_type": "DEPOT",
                    "items": [
                      {
                        "item_code": "75579",
                        "quantity": 5,
                        "weight": 60000,
                        "cbm": 510720,
                        "size": [
                          {
                            "length": 96,
                            "width": 38,
                            "height": 28
                          },
                          {
                            "length": 38,
                            "width": 96,
                            "height": 28
                          }
                        ],
                        "size_index": [
                          0,
                          0,
                          0,
                          0,
                          0
                        ],
                        "position": [
                          {
                            "x": 642,
                            "y": 69,
                            "z": 0
                          },
                          {
                            "x": 642,
                            "y": 69,
                            "z": 28
                          },
                          {
                            "x": 642,
                            "y": 69,
                            "z": 56
                          },
                          {
                            "x": 546,
                            "y": 0,
                            "z": 144
                          },
                          {
                            "x": 546,
                            "y": 0,
                            "z": 172
                          }
                        ]
                      },
                      {
                        "item_code": "75580",
                        "quantity": 5,
                        "weight": 100000,
                        "cbm": 788025,
                        "size": [
                          {
                            "length": 79,
                            "width": 35,
                            "height": 57
                          },
                          {
                            "length": 35,
                            "width": 79,
                            "height": 57
                          }
                        ],
                        "size_index": [
                          1,
                          1,
                          0,
                          0,
                          0
                        ],
                        "position": [
                          {
                            "x": 422,
                            "y": 79,
                            "z": 136
                          },
                          {
                            "x": 464,
                            "y": 79,
                            "z": 136
                          },
                          {
                            "x": 210,
                            "y": 187,
                            "z": 0
                          },
                          {
                            "x": 210,
                            "y": 187,
                            "z": 57
                          },
                          {
                            "x": 210,
                            "y": 187,
                            "z": 114
                          }
                        ]
                      },
                      {
                        "item_code": "75581",
                        "quantity": 2,
                        "weight": 58000,
                        "cbm": 535296,
                        "size": [
                          {
                            "length": 96,
                            "width": 41,
                            "height": 68
                          },
                          {
                            "length": 41,
                            "width": 96,
                            "height": 68
                          }
                        ],
                        "size_index": [
                          0,
                          0
                        ],
                        "position": [
                          {
                            "x": 546,
                            "y": 69,
                            "z": 68
                          },
                          {
                            "x": 546,
                            "y": 69,
                            "z": 136
                          }
                        ]
                      },
                      {
                        "item_code": "75582",
                        "quantity": 2,
                        "weight": 18000,
                        "cbm": 156950,
                        "size": [
                          {
                            "length": 86,
                            "width": 36,
                            "height": 25
                          },
                          {
                            "length": 36,
                            "width": 86,
                            "height": 25
                          }
                        ],
                        "size_index": [
                          0,
                          0
                        ],
                        "position": [
                          {
                            "x": 660,
                            "y": 107,
                            "z": 180
                          },
                          {
                            "x": 660,
                            "y": 147,
                            "z": 120
                          }
                        ]
                      },
                      {
                        "item_code": "75495",
                        "quantity": 1,
                        "weight": 108000,
                        "cbm": 1447380,
                        "size": [
                          {
                            "length": 86,
                            "width": 85,
                            "height": 198
                          },
                          {
                            "length": 85,
                            "width": 86,
                            "height": 198
                          }
                        ],
                        "size_index": [
                          0
                        ],
                        "position": [
                          {
                            "x": 0,
                            "y": 0,
                            "z": 0
                          }
                        ]
                      },
                      {
                        "item_code": "75587",
                        "quantity": 5,
                        "weight": 45000,
                        "cbm": 405705,
                        "size": [
                          {
                            "length": 86,
                            "width": 37,
                            "height": 25
                          },
                          {
                            "length": 37,
                            "width": 86,
                            "height": 25
                          }
                        ],
                        "size_index": [
                          0,
                          0,
                          0,
                          0,
                          0
                        ],
                        "position": [
                          {
                            "x": 642,
                            "y": 69,
                            "z": 84
                          },
                          {
                            "x": 642,
                            "y": 69,
                            "z": 109
                          },
                          {
                            "x": 642,
                            "y": 69,
                            "z": 134
                          },
                          {
                            "x": 642,
                            "y": 69,
                            "z": 159
                          },
                          {
                            "x": 642,
                            "y": 69,
                            "z": 184
                          }
                        ]
                      },
                      {
                        "item_code": "75588",
                        "quantity": 5,
                        "weight": 135000,
                        "cbm": 1080000,
                        "size": [
                          {
                            "length": 90,
                            "width": 40,
                            "height": 60
                          },
                          {
                            "length": 40,
                            "width": 90,
                            "height": 60
                          }
                        ],
                        "size_index": [
                          0,
                          0,
                          0,
                          0,
                          0
                        ],
                        "position": [
                          {
                            "x": 660,
                            "y": 107,
                            "z": 0
                          },
                          {
                            "x": 660,
                            "y": 107,
                            "z": 60
                          },
                          {
                            "x": 660,
                            "y": 107,
                            "z": 120
                          },
                          {
                            "x": 660,
                            "y": 147,
                            "z": 0
                          },
                          {
                            "x": 660,
                            "y": 147,
                            "z": 60
                          }
                        ]
                      },
                      {
                        "item_code": "75614",
                        "quantity": 10,
                        "weight": 140000,
                        "cbm": 1336873,
                        "size": [
                          {
                            "length": 115,
                            "width": 37,
                            "height": 31
                          },
                          {
                            "length": 37,
                            "width": 115,
                            "height": 31
                          }
                        ],
                        "size_index": [
                          1,
                          1,
                          1,
                          1,
                          1,
                          1,
                          1,
                          1,
                          1,
                          1
                        ],
                        "position": [
                          {
                            "x": 566,
                            "y": 111,
                            "z": 82
                          },
                          {
                            "x": 566,
                            "y": 111,
                            "z": 113
                          },
                          {
                            "x": 566,
                            "y": 111,
                            "z": 144
                          },
                          {
                            "x": 566,
                            "y": 111,
                            "z": 175
                          },
                          {
                            "x": 613,
                            "y": 111,
                            "z": 164
                          },
                          {
                            "x": 385,
                            "y": 79,
                            "z": 0
                          },
                          {
                            "x": 385,
                            "y": 79,
                            "z": 31
                          },
                          {
                            "x": 385,
                            "y": 79,
                            "z": 62
                          },
                          {
                            "x": 385,
                            "y": 79,
                            "z": 93
                          },
                          {
                            "x": 385,
                            "y": 79,
                            "z": 124
                          }
                        ]
                      },
                      {
                        "item_code": "75615",
                        "quantity": 10,
                        "weight": 350000,
                        "cbm": 2774400,
                        "size": [
                          {
                            "length": 96,
                            "width": 42,
                            "height": 68
                          },
                          {
                            "length": 42,
                            "width": 96,
                            "height": 68
                          }
                        ],
                        "size_index": [
                          0,
                          0,
                          0,
                          0,
                          0,
                          0,
                          0,
                          0,
                          0,
                          0
                        ],
                        "position": [
                          {
                            "x": 546,
                            "y": 69,
                            "z": 0
                          },
                          {
                            "x": 86,
                            "y": 0,
                            "z": 0
                          },
                          {
                            "x": 86,
                            "y": 0,
                            "z": 68
                          },
                          {
                            "x": 86,
                            "y": 0,
                            "z": 136
                          },
                          {
                            "x": 86,
                            "y": 42,
                            "z": 0
                          },
                          {
                            "x": 86,
                            "y": 42,
                            "z": 68
                          },
                          {
                            "x": 86,
                            "y": 42,
                            "z": 136
                          },
                          {
                            "x": 86,
                            "y": 84,
                            "z": 0
                          },
                          {
                            "x": 86,
                            "y": 84,
                            "z": 68
                          },
                          {
                            "x": 86,
                            "y": 84,
                            "z": 136
                          }
                        ]
                      },
                      {
                        "item_code": "75553",
                        "quantity": 1,
                        "weight": 3000,
                        "cbm": 25088,
                        "size": [
                          {
                            "length": 28,
                            "width": 28,
                            "height": 32
                          },
                          {
                            "length": 28,
                            "width": 28,
                            "height": 32
                          }
                        ],
                        "size_index": [
                          0
                        ],
                        "position": [
                          {
                            "x": 210,
                            "y": 187,
                            "z": 171
                          }
                        ]
                      },
                      {
                        "item_code": "75568",
                        "quantity": 3,
                        "weight": 147000,
                        "cbm": 1987200,
                        "size": [
                          {
                            "length": 200,
                            "width": 69,
                            "height": 48
                          },
                          {
                            "length": 69,
                            "width": 200,
                            "height": 48
                          }
                        ],
                        "size_index": [
                          0,
                          0,
                          0
                        ],
                        "position": [
                          {
                            "x": 546,
                            "y": 0,
                            "z": 0
                          },
                          {
                            "x": 546,
                            "y": 0,
                            "z": 48
                          },
                          {
                            "x": 546,
                            "y": 0,
                            "z": 96
                          }
                        ]
                      },
                      {
                        "item_code": "75569",
                        "quantity": 3,
                        "weight": 156000,
                        "cbm": 1352754,
                        "size": [
                          {
                            "length": 117,
                            "width": 47,
                            "height": 82
                          },
                          {
                            "length": 47,
                            "width": 117,
                            "height": 82
                          }
                        ],
                        "size_index": [
                          1,
                          1,
                          1
                        ],
                        "position": [
                          {
                            "x": 566,
                            "y": 111,
                            "z": 0
                          },
                          {
                            "x": 613,
                            "y": 111,
                            "z": 0
                          },
                          {
                            "x": 613,
                            "y": 111,
                            "z": 82
                          }
                        ]
                      },
                      {
                        "item_code": "75616",
                        "quantity": 3,
                        "weight": 69000,
                        "cbm": 640800,
                        "size": [
                          {
                            "length": 89,
                            "width": 40,
                            "height": 60
                          },
                          {
                            "length": 40,
                            "width": 89,
                            "height": 60
                          }
                        ],
                        "size_index": [
                          0,
                          0,
                          0
                        ],
                        "position": [
                          {
                            "x": 86,
                            "y": 126,
                            "z": 0
                          },
                          {
                            "x": 86,
                            "y": 126,
                            "z": 60
                          },
                          {
                            "x": 86,
                            "y": 126,
                            "z": 120
                          }
                        ]
                      },
                      {
                        "item_code": "75617",
                        "quantity": 3,
                        "weight": 24000,
                        "cbm": 235425,
                        "size": [
                          {
                            "length": 86,
                            "width": 36,
                            "height": 25
                          },
                          {
                            "length": 36,
                            "width": 86,
                            "height": 25
                          }
                        ],
                        "size_index": [
                          1,
                          1,
                          1
                        ],
                        "position": [
                          {
                            "x": 182,
                            "y": 0,
                            "z": 81
                          },
                          {
                            "x": 182,
                            "y": 0,
                            "z": 106
                          },
                          {
                            "x": 182,
                            "y": 0,
                            "z": 131
                          }
                        ]
                      },
                      {
                        "item_code": "75618",
                        "quantity": 2,
                        "weight": 74000,
                        "cbm": 548352,
                        "size": [
                          {
                            "length": 96,
                            "width": 42,
                            "height": 68
                          },
                          {
                            "length": 42,
                            "width": 96,
                            "height": 68
                          }
                        ],
                        "size_index": [
                          1,
                          1
                        ],
                        "position": [
                          {
                            "x": 422,
                            "y": 79,
                            "z": 0
                          },
                          {
                            "x": 422,
                            "y": 79,
                            "z": 68
                          }
                        ]
                      },
                      {
                        "item_code": "75619",
                        "quantity": 2,
                        "weight": 24000,
                        "cbm": 267374,
                        "size": [
                          {
                            "length": 115,
                            "width": 37,
                            "height": 31
                          },
                          {
                            "length": 37,
                            "width": 115,
                            "height": 31
                          }
                        ],
                        "size_index": [
                          1,
                          1
                        ],
                        "position": [
                          {
                            "x": 385,
                            "y": 79,
                            "z": 155
                          },
                          {
                            "x": 182,
                            "y": 0,
                            "z": 0
                          }
                        ]
                      },
                      {
                        "item_code": "75620",
                        "quantity": 5,
                        "weight": 145000,
                        "cbm": 1338240,
                        "size": [
                          {
                            "length": 96,
                            "width": 41,
                            "height": 68
                          },
                          {
                            "length": 41,
                            "width": 96,
                            "height": 68
                          }
                        ],
                        "size_index": [
                          1,
                          1,
                          0,
                          0,
                          0
                        ],
                        "position": [
                          {
                            "x": 464,
                            "y": 79,
                            "z": 0
                          },
                          {
                            "x": 464,
                            "y": 79,
                            "z": 68
                          },
                          {
                            "x": 219,
                            "y": 0,
                            "z": 0
                          },
                          {
                            "x": 219,
                            "y": 0,
                            "z": 68
                          },
                          {
                            "x": 219,
                            "y": 0,
                            "z": 136
                          }
                        ]
                      },
                      {
                        "item_code": "75621",
                        "quantity": 5,
                        "weight": 45000,
                        "cbm": 392375,
                        "size": [
                          {
                            "length": 86,
                            "width": 36,
                            "height": 25
                          },
                          {
                            "length": 36,
                            "width": 86,
                            "height": 25
                          }
                        ],
                        "size_index": [
                          0,
                          0,
                          0,
                          1,
                          1
                        ],
                        "position": [
                          {
                            "x": 385,
                            "y": 0,
                            "z": 28
                          },
                          {
                            "x": 385,
                            "y": 38,
                            "z": 136
                          },
                          {
                            "x": 385,
                            "y": 38,
                            "z": 161
                          },
                          {
                            "x": 182,
                            "y": 0,
                            "z": 31
                          },
                          {
                            "x": 182,
                            "y": 0,
                            "z": 56
                          }
                        ]
                      },
                      {
                        "item_code": "75633",
                        "quantity": 1,
                        "weight": 725,
                        "cbm": 42282,
                        "size": [
                          {
                            "length": 58,
                            "width": 27,
                            "height": 27
                          },
                          {
                            "length": 27,
                            "width": 58,
                            "height": 27
                          }
                        ],
                        "size_index": [
                          0
                        ],
                        "position": [
                          {
                            "x": 546,
                            "y": 38,
                            "z": 144
                          }
                        ]
                      },
                      {
                        "item_code": "75550",
                        "quantity": 1,
                        "weight": 725,
                        "cbm": 42282,
                        "size": [
                          {
                            "length": 58,
                            "width": 27,
                            "height": 27
                          },
                          {
                            "length": 27,
                            "width": 58,
                            "height": 27
                          }
                        ],
                        "size_index": [
                          0
                        ],
                        "position": [
                          {
                            "x": 289,
                            "y": 154,
                            "z": 133
                          }
                        ]
                      },
                      {
                        "item_code": "75560",
                        "quantity": 15,
                        "weight": 180000,
                        "cbm": 1532160,
                        "size": [
                          {
                            "length": 96,
                            "width": 38,
                            "height": 28
                          },
                          {
                            "length": 38,
                            "width": 96,
                            "height": 28
                          }
                        ],
                        "size_index": [
                          0,
                          0,
                          0,
                          0,
                          0,
                          0,
                          0,
                          0,
                          0,
                          0,
                          0,
                          0,
                          0,
                          0,
                          0
                        ],
                        "position": [
                          {
                            "x": 385,
                            "y": 0,
                            "z": 0
                          },
                          {
                            "x": 219,
                            "y": 41,
                            "z": 0
                          },
                          {
                            "x": 219,
                            "y": 41,
                            "z": 28
                          },
                          {
                            "x": 219,
                            "y": 41,
                            "z": 56
                          },
                          {
                            "x": 219,
                            "y": 41,
                            "z": 84
                          },
                          {
                            "x": 219,
                            "y": 41,
                            "z": 112
                          },
                          {
                            "x": 219,
                            "y": 41,
                            "z": 140
                          },
                          {
                            "x": 219,
                            "y": 41,
                            "z": 168
                          },
                          {
                            "x": 219,
                            "y": 79,
                            "z": 0
                          },
                          {
                            "x": 219,
                            "y": 79,
                            "z": 28
                          },
                          {
                            "x": 219,
                            "y": 79,
                            "z": 56
                          },
                          {
                            "x": 219,
                            "y": 79,
                            "z": 84
                          },
                          {
                            "x": 219,
                            "y": 79,
                            "z": 112
                          },
                          {
                            "x": 219,
                            "y": 79,
                            "z": 140
                          },
                          {
                            "x": 219,
                            "y": 79,
                            "z": 168
                          }
                        ]
                      },
                      {
                        "item_code": "75561",
                        "quantity": 15,
                        "weight": 300000,
                        "cbm": 2364075,
                        "size": [
                          {
                            "length": 79,
                            "width": 35,
                            "height": 57
                          },
                          {
                            "length": 35,
                            "width": 79,
                            "height": 57
                          }
                        ],
                        "size_index": [
                          1,
                          1,
                          1,
                          1,
                          1,
                          1,
                          0,
                          0,
                          0,
                          0,
                          0,
                          0,
                          1,
                          1,
                          1
                        ],
                        "position": [
                          {
                            "x": 315,
                            "y": 75,
                            "z": 0
                          },
                          {
                            "x": 315,
                            "y": 75,
                            "z": 57
                          },
                          {
                            "x": 315,
                            "y": 75,
                            "z": 114
                          },
                          {
                            "x": 350,
                            "y": 75,
                            "z": 0
                          },
                          {
                            "x": 350,
                            "y": 75,
                            "z": 57
                          },
                          {
                            "x": 350,
                            "y": 75,
                            "z": 114
                          },
                          {
                            "x": 210,
                            "y": 117,
                            "z": 0
                          },
                          {
                            "x": 210,
                            "y": 117,
                            "z": 57
                          },
                          {
                            "x": 210,
                            "y": 117,
                            "z": 114
                          },
                          {
                            "x": 210,
                            "y": 152,
                            "z": 0
                          },
                          {
                            "x": 210,
                            "y": 152,
                            "z": 57
                          },
                          {
                            "x": 210,
                            "y": 152,
                            "z": 114
                          },
                          {
                            "x": 175,
                            "y": 126,
                            "z": 0
                          },
                          {
                            "x": 175,
                            "y": 126,
                            "z": 57
                          },
                          {
                            "x": 175,
                            "y": 126,
                            "z": 114
                          }
                        ]
                      },
                      {
                        "item_code": "75562",
                        "quantity": 2,
                        "weight": 58000,
                        "cbm": 535296,
                        "size": [
                          {
                            "length": 96,
                            "width": 41,
                            "height": 68
                          },
                          {
                            "length": 41,
                            "width": 96,
                            "height": 68
                          }
                        ],
                        "size_index": [
                          0,
                          0
                        ],
                        "position": [
                          {
                            "x": 385,
                            "y": 38,
                            "z": 0
                          },
                          {
                            "x": 385,
                            "y": 38,
                            "z": 68
                          }
                        ]
                      },
                      {
                        "item_code": "75563",
                        "quantity": 2,
                        "weight": 18000,
                        "cbm": 156950,
                        "size": [
                          {
                            "length": 86,
                            "width": 36,
                            "height": 25
                          },
                          {
                            "length": 36,
                            "width": 86,
                            "height": 25
                          }
                        ],
                        "size_index": [
                          0,
                          0
                        ],
                        "position": [
                          {
                            "x": 385,
                            "y": 0,
                            "z": 53
                          },
                          {
                            "x": 385,
                            "y": 0,
                            "z": 78
                          }
                        ]
                      },
                      {
                        "item_code": "75566",
                        "quantity": 1,
                        "weight": 108000,
                        "cbm": 1447380,
                        "size": [
                          {
                            "length": 86,
                            "width": 85,
                            "height": 198
                          },
                          {
                            "length": 85,
                            "width": 86,
                            "height": 198
                          }
                        ],
                        "size_index": [
                          0
                        ],
                        "position": [
                          {
                            "x": 0,
                            "y": 85,
                            "z": 0
                          }
                        ]
                      },
                      {
                        "item_code": "75567",
                        "quantity": 1,
                        "weight": 66000,
                        "cbm": 885632,
                        "size": [
                          {
                            "length": 74,
                            "width": 64,
                            "height": 187
                          },
                          {
                            "length": 64,
                            "width": 74,
                            "height": 187
                          }
                        ],
                        "size_index": [
                          0
                        ],
                        "position": [
                          {
                            "x": 86,
                            "y": 166,
                            "z": 0
                          }
                        ]
                      },
                      {
                        "item_code": "75572",
                        "quantity": 1,
                        "weight": 58000,
                        "cbm": 775125,
                        "size": [
                          {
                            "length": 75,
                            "width": 65,
                            "height": 159
                          },
                          {
                            "length": 65,
                            "width": 75,
                            "height": 159
                          }
                        ],
                        "size_index": [
                          1
                        ],
                        "position": [
                          {
                            "x": 481,
                            "y": 0,
                            "z": 0
                          }
                        ]
                      },
                      {
                        "item_code": "75573",
                        "quantity": 1,
                        "weight": 35000,
                        "cbm": 524552,
                        "size": [
                          {
                            "length": 68,
                            "width": 58,
                            "height": 133
                          },
                          {
                            "length": 58,
                            "width": 68,
                            "height": 133
                          }
                        ],
                        "size_index": [
                          0
                        ],
                        "position": [
                          {
                            "x": 289,
                            "y": 154,
                            "z": 0
                          }
                        ]
                      },
                      {
                        "item_code": "75574",
                        "quantity": 1,
                        "weight": 65000,
                        "cbm": 987000,
                        "size": [
                          {
                            "length": 75,
                            "width": 70,
                            "height": 188
                          },
                          {
                            "length": 70,
                            "width": 75,
                            "height": 188
                          }
                        ],
                        "size_index": [
                          1
                        ],
                        "position": [
                          {
                            "x": 315,
                            "y": 0,
                            "z": 0
                          }
                        ]
                      },
                      {
                        "item_code": "75624",
                        "quantity": 1,
                        "weight": 3000,
                        "cbm": 25088,
                        "size": [
                          {
                            "length": 28,
                            "width": 28,
                            "height": 32
                          },
                          {
                            "length": 28,
                            "width": 28,
                            "height": 32
                          }
                        ],
                        "size_index": [
                          1
                        ],
                        "position": [
                          {
                            "x": 315,
                            "y": 75,
                            "z": 171
                          }
                        ]
                      },
                      {
                        "item_code": "75626",
                        "quantity": 1,
                        "weight": 725,
                        "cbm": 42282,
                        "size": [
                          {
                            "length": 58,
                            "width": 27,
                            "height": 27
                          },
                          {
                            "length": 27,
                            "width": 58,
                            "height": 27
                          }
                        ],
                        "size_index": [
                          1
                        ],
                        "position": [
                          {
                            "x": 481,
                            "y": 0,
                            "z": 159
                          }
                        ]
                      },
                      {
                        "item_code": "75627",
                        "quantity": 2,
                        "weight": 5600,
                        "cbm": 40300,
                        "size": [
                          {
                            "length": 26,
                            "width": 25,
                            "height": 31
                          },
                          {
                            "length": 25,
                            "width": 26,
                            "height": 31
                          }
                        ],
                        "size_index": [
                          1,
                          1
                        ],
                        "position": [
                          {
                            "x": 505,
                            "y": 151,
                            "z": 113
                          },
                          {
                            "x": 505,
                            "y": 151,
                            "z": 144
                          }
                        ]
                      },
                      {
                        "item_code": "75628",
                        "quantity": 1,
                        "weight": 3000,
                        "cbm": 25088,
                        "size": [
                          {
                            "length": 28,
                            "width": 28,
                            "height": 32
                          },
                          {
                            "length": 28,
                            "width": 28,
                            "height": 32
                          }
                        ],
                        "size_index": [
                          1
                        ],
                        "position": [
                          {
                            "x": 508,
                            "y": 0,
                            "z": 159
                          }
                        ]
                      },
                      {
                        "item_code": "75629",
                        "quantity": 1,
                        "weight": 4100,
                        "cbm": 35573,
                        "size": [
                          {
                            "length": 31,
                            "width": 25,
                            "height": 45
                          },
                          {
                            "length": 25,
                            "width": 31,
                            "height": 45
                          }
                        ],
                        "size_index": [
                          0
                        ],
                        "position": [
                          {
                            "x": 508,
                            "y": 28,
                            "z": 159
                          }
                        ]
                      },
                      {
                        "item_code": "75630",
                        "quantity": 2,
                        "weight": 8000,
                        "cbm": 56072,
                        "size": [
                          {
                            "length": 40,
                            "width": 19,
                            "height": 35
                          },
                          {
                            "length": 19,
                            "width": 40,
                            "height": 35
                          }
                        ],
                        "size_index": [
                          1,
                          1
                        ],
                        "position": [
                          {
                            "x": 505,
                            "y": 111,
                            "z": 113
                          },
                          {
                            "x": 505,
                            "y": 111,
                            "z": 148
                          }
                        ]
                      },
                      {
                        "item_code": "76077",
                        "quantity": 1,
                        "weight": 40000,
                        "cbm": 479515,
                        "size": [
                          {
                            "length": 69,
                            "width": 61,
                            "height": 113
                          },
                          {
                            "length": 61,
                            "width": 69,
                            "height": 113
                          }
                        ],
                        "size_index": [
                          1
                        ],
                        "position": [
                          {
                            "x": 505,
                            "y": 111,
                            "z": 0
                          }
                        ]
                      }
                    ]
                  },
                  {
                    "location_code": "5000005410",
                    "cd_code": "NPP Panasonic",
                    "distance": 43297,
                    "weight_load": 2654150,
                    "cbm_load": 25777330,
                    "arrival_time": "2023-05-15 10:41:57",
                    "leaving_time": "2023-05-15 11:12:05",
                    "location_type": "CUSTOMER",
                    "items": [
                      {
                        "item_code": "75633",
                        "quantity": 1,
                        "weight": 725,
                        "cbm": 42282,
                        "size": [
                          {
                            "length": 58,
                            "width": 27,
                            "height": 27
                          }
                        ],
                        "size_index": [],
                        "position": []
                      }
                    ]
                  },
                  {
                    "location_code": "6000018276",
                    "cd_code": "NPP Panasonic",
                    "distance": 44920,
                    "weight_load": 1972150,
                    "cbm_load": 18566577,
                    "arrival_time": "2023-05-15 11:15:19",
                    "leaving_time": "2023-05-15 13:06:57",
                    "location_type": "CUSTOMER",
                    "items": [
                      {
                        "item_code": "75579",
                        "quantity": 5,
                        "weight": 60000,
                        "cbm": 510720,
                        "size": [
                          {
                            "length": 96,
                            "width": 38,
                            "height": 28
                          }
                        ],
                        "size_index": [],
                        "position": []
                      },
                      {
                        "item_code": "75580",
                        "quantity": 5,
                        "weight": 100000,
                        "cbm": 788025,
                        "size": [
                          {
                            "length": 79,
                            "width": 35,
                            "height": 57
                          }
                        ],
                        "size_index": [],
                        "position": []
                      },
                      {
                        "item_code": "75581",
                        "quantity": 2,
                        "weight": 58000,
                        "cbm": 535296,
                        "size": [
                          {
                            "length": 96,
                            "width": 41,
                            "height": 68
                          }
                        ],
                        "size_index": [],
                        "position": []
                      },
                      {
                        "item_code": "75582",
                        "quantity": 2,
                        "weight": 18000,
                        "cbm": 156950,
                        "size": [
                          {
                            "length": 86,
                            "width": 36,
                            "height": 25
                          }
                        ],
                        "size_index": [],
                        "position": []
                      },
                      {
                        "item_code": "75495",
                        "quantity": 1,
                        "weight": 108000,
                        "cbm": 1447380,
                        "size": [
                          {
                            "length": 86,
                            "width": 85,
                            "height": 198
                          }
                        ],
                        "size_index": [],
                        "position": []
                      },
                      {
                        "item_code": "75587",
                        "quantity": 5,
                        "weight": 45000,
                        "cbm": 405705,
                        "size": [
                          {
                            "length": 86,
                            "width": 37,
                            "height": 25
                          }
                        ],
                        "size_index": [],
                        "position": []
                      },
                      {
                        "item_code": "75588",
                        "quantity": 5,
                        "weight": 135000,
                        "cbm": 1080000,
                        "size": [
                          {
                            "length": 90,
                            "width": 40,
                            "height": 60
                          }
                        ],
                        "size_index": [],
                        "position": []
                      },
                      {
                        "item_code": "75572",
                        "quantity": 1,
                        "weight": 58000,
                        "cbm": 775125,
                        "size": [
                          {
                            "length": 75,
                            "width": 65,
                            "height": 159
                          }
                        ],
                        "size_index": [],
                        "position": []
                      },
                      {
                        "item_code": "75573",
                        "quantity": 1,
                        "weight": 35000,
                        "cbm": 524552,
                        "size": [
                          {
                            "length": 68,
                            "width": 58,
                            "height": 133
                          }
                        ],
                        "size_index": [],
                        "position": []
                      },
                      {
                        "item_code": "75574",
                        "quantity": 1,
                        "weight": 65000,
                        "cbm": 987000,
                        "size": [
                          {
                            "length": 75,
                            "width": 70,
                            "height": 188
                          }
                        ],
                        "size_index": [],
                        "position": []
                      }
                    ]
                  },
                  {
                    "location_code": "5000014944",
                    "cd_code": "NPP Panasonic",
                    "distance": 44920,
                    "weight_load": 1179150,
                    "cbm_load": 11115348,
                    "arrival_time": "2023-05-15 13:06:57",
                    "leaving_time": "2023-05-15 13:59:19",
                    "location_type": "CUSTOMER",
                    "items": [
                      {
                        "item_code": "75614",
                        "quantity": 10,
                        "weight": 140000,
                        "cbm": 1336875,
                        "size": [
                          {
                            "length": 115,
                            "width": 37,
                            "height": 31
                          }
                        ],
                        "size_index": [],
                        "position": []
                      },
                      {
                        "item_code": "75615",
                        "quantity": 10,
                        "weight": 350000,
                        "cbm": 2774400,
                        "size": [
                          {
                            "length": 96,
                            "width": 42,
                            "height": 68
                          }
                        ],
                        "size_index": [],
                        "position": []
                      },
                      {
                        "item_code": "75568",
                        "quantity": 3,
                        "weight": 147000,
                        "cbm": 1987200,
                        "size": [
                          {
                            "length": 200,
                            "width": 69,
                            "height": 48
                          }
                        ],
                        "size_index": [],
                        "position": []
                      },
                      {
                        "item_code": "75569",
                        "quantity": 3,
                        "weight": 156000,
                        "cbm": 1352754,
                        "size": [
                          {
                            "length": 117,
                            "width": 47,
                            "height": 82
                          }
                        ],
                        "size_index": [],
                        "position": []
                      }
                    ]
                  },
                  {
                    "location_code": "6000020693",
                    "cd_code": "NPP Panasonic",
                    "distance": 45856,
                    "weight_load": 1139150,
                    "cbm_load": 10635833,
                    "arrival_time": "2023-05-15 14:01:37",
                    "leaving_time": "2023-05-15 14:33:04",
                    "location_type": "CUSTOMER",
                    "items": [
                      {
                        "item_code": "76077",
                        "quantity": 1,
                        "weight": 40000,
                        "cbm": 479515,
                        "size": [
                          {
                            "length": 69,
                            "width": 61,
                            "height": 113
                          }
                        ],
                        "size_index": [],
                        "position": []
                      }
                    ]
                  },
                  {
                    "location_code": "5000003588",
                    "cd_code": "NPP Panasonic",
                    "distance": 46387,
                    "weight_load": 736725,
                    "cbm_load": 7013951,
                    "arrival_time": "2023-05-15 14:33:53",
                    "leaving_time": "2023-05-15 15:14:45",
                    "location_type": "CUSTOMER",
                    "items": [
                      {
                        "item_code": "75616",
                        "quantity": 3,
                        "weight": 69000,
                        "cbm": 640800,
                        "size": [
                          {
                            "length": 89,
                            "width": 40,
                            "height": 60
                          }
                        ],
                        "size_index": [],
                        "position": []
                      },
                      {
                        "item_code": "75617",
                        "quantity": 3,
                        "weight": 24000,
                        "cbm": 235425,
                        "size": [
                          {
                            "length": 86,
                            "width": 36,
                            "height": 25
                          }
                        ],
                        "size_index": [],
                        "position": []
                      },
                      {
                        "item_code": "75618",
                        "quantity": 2,
                        "weight": 74000,
                        "cbm": 548352,
                        "size": [
                          {
                            "length": 96,
                            "width": 42,
                            "height": 68
                          }
                        ],
                        "size_index": [],
                        "position": []
                      },
                      {
                        "item_code": "75619",
                        "quantity": 2,
                        "weight": 24000,
                        "cbm": 267375,
                        "size": [
                          {
                            "length": 115,
                            "width": 37,
                            "height": 31
                          }
                        ],
                        "size_index": [],
                        "position": []
                      },
                      {
                        "item_code": "75620",
                        "quantity": 5,
                        "weight": 145000,
                        "cbm": 1338240,
                        "size": [
                          {
                            "length": 96,
                            "width": 41,
                            "height": 68
                          }
                        ],
                        "size_index": [],
                        "position": []
                      },
                      {
                        "item_code": "75621",
                        "quantity": 5,
                        "weight": 45000,
                        "cbm": 392375,
                        "size": [
                          {
                            "length": 86,
                            "width": 36,
                            "height": 25
                          }
                        ],
                        "size_index": [],
                        "position": []
                      },
                      {
                        "item_code": "75626",
                        "quantity": 1,
                        "weight": 725,
                        "cbm": 42282,
                        "size": [
                          {
                            "length": 58,
                            "width": 27,
                            "height": 27
                          }
                        ],
                        "size_index": [],
                        "position": []
                      },
                      {
                        "item_code": "75627",
                        "quantity": 2,
                        "weight": 5600,
                        "cbm": 40300,
                        "size": [
                          {
                            "length": 26,
                            "width": 25,
                            "height": 31
                          }
                        ],
                        "size_index": [],
                        "position": []
                      },
                      {
                        "item_code": "75628",
                        "quantity": 1,
                        "weight": 3000,
                        "cbm": 25088,
                        "size": [
                          {
                            "length": 28,
                            "width": 28,
                            "height": 32
                          }
                        ],
                        "size_index": [],
                        "position": []
                      },
                      {
                        "item_code": "75629",
                        "quantity": 1,
                        "weight": 4100,
                        "cbm": 35573,
                        "size": [
                          {
                            "length": 31,
                            "width": 25,
                            "height": 45
                          }
                        ],
                        "size_index": [],
                        "position": []
                      },
                      {
                        "item_code": "75630",
                        "quantity": 2,
                        "weight": 8000,
                        "cbm": 56072,
                        "size": [
                          {
                            "length": 40,
                            "width": 19,
                            "height": 35
                          }
                        ],
                        "size_index": [],
                        "position": []
                      }
                    ]
                  },
                  {
                    "location_code": "5000012037",
                    "cd_code": "NPP Panasonic",
                    "distance": 50685,
                    "weight_load": 736000,
                    "cbm_load": 6971669,
                    "arrival_time": "2023-05-15 15:22:11",
                    "leaving_time": "2023-05-15 15:52:19",
                    "location_type": "CUSTOMER",
                    "items": [
                      {
                        "item_code": "75550",
                        "quantity": 1,
                        "weight": 725,
                        "cbm": 42282,
                        "size": [
                          {
                            "length": 58,
                            "width": 27,
                            "height": 27
                          }
                        ],
                        "size_index": [],
                        "position": []
                      }
                    ]
                  },
                  {
                    "location_code": "6000011024",
                    "cd_code": "NPP Panasonic",
                    "distance": 61211,
                    "weight_load": 6000,
                    "cbm_load": 50176,
                    "arrival_time": "2023-05-15 16:08:52",
                    "leaving_time": "2023-05-15 16:59:38",
                    "location_type": "CUSTOMER",
                    "items": [
                      {
                        "item_code": "75560",
                        "quantity": 15,
                        "weight": 180000,
                        "cbm": 1532160,
                        "size": [
                          {
                            "length": 96,
                            "width": 38,
                            "height": 28
                          }
                        ],
                        "size_index": [],
                        "position": []
                      },
                      {
                        "item_code": "75561",
                        "quantity": 15,
                        "weight": 300000,
                        "cbm": 2364075,
                        "size": [
                          {
                            "length": 79,
                            "width": 35,
                            "height": 57
                          }
                        ],
                        "size_index": [],
                        "position": []
                      },
                      {
                        "item_code": "75562",
                        "quantity": 2,
                        "weight": 58000,
                        "cbm": 535296,
                        "size": [
                          {
                            "length": 96,
                            "width": 41,
                            "height": 68
                          }
                        ],
                        "size_index": [],
                        "position": []
                      },
                      {
                        "item_code": "75563",
                        "quantity": 2,
                        "weight": 18000,
                        "cbm": 156950,
                        "size": [
                          {
                            "length": 86,
                            "width": 36,
                            "height": 25
                          }
                        ],
                        "size_index": [],
                        "position": []
                      },
                      {
                        "item_code": "75566",
                        "quantity": 1,
                        "weight": 108000,
                        "cbm": 1447380,
                        "size": [
                          {
                            "length": 86,
                            "width": 85,
                            "height": 198
                          }
                        ],
                        "size_index": [],
                        "position": []
                      },
                      {
                        "item_code": "75567",
                        "quantity": 1,
                        "weight": 66000,
                        "cbm": 885632,
                        "size": [
                          {
                            "length": 74,
                            "width": 64,
                            "height": 187
                          }
                        ],
                        "size_index": [],
                        "position": []
                      }
                    ]
                  },
                  {
                    "location_code": "5000014726",
                    "cd_code": "NPP Panasonic",
                    "distance": 62285,
                    "weight_load": 3000,
                    "cbm_load": 25088,
                    "arrival_time": "2023-05-15 17:01:04",
                    "leaving_time": "2023-05-15 17:31:09",
                    "location_type": "CUSTOMER",
                    "items": [
                      {
                        "item_code": "75553",
                        "quantity": 1,
                        "weight": 3000,
                        "cbm": 25088,
                        "size": [
                          {
                            "length": 28,
                            "width": 28,
                            "height": 32
                          }
                        ],
                        "size_index": [],
                        "position": []
                      }
                    ]
                  },
                  {
                    "location_code": "5000012774",
                    "cd_code": "NPP Panasonic",
                    "distance": 65203,
                    "weight_load": 0,
                    "cbm_load": 0,
                    "arrival_time": "2023-05-15 17:38:49",
                    "leaving_time": "2023-05-15 18:08:54",
                    "location_type": "CUSTOMER",
                    "items": [
                      {
                        "item_code": "75624",
                        "quantity": 1,
                        "weight": 3000,
                        "cbm": 25088,
                        "size": [
                          {
                            "length": 28,
                            "width": 28,
                            "height": 32
                          }
                        ],
                        "size_index": [],
                        "position": []
                      }
                    ]
                  },
                  {
                    "location_code": "5000012774",
                    "cd_code": "NPP Panasonic",
                    "distance": 65203,
                    "weight_load": 0,
                    "cbm_load": 0,
                    "arrival_time": "2023-05-15 18:08:54",
                    "leaving_time": "2023-05-15 18:08:54",
                    "location_type": "STATION",
                    "items": []
                  }
                ]
              })
        });
        const data = await get.json();
        console.log("data: ", data);

        var containerDimensions = {};

        //read variables from container form
        containerDimensions.w = data.containers[0].stack.containerStackValue.dx  / 100;
        containerDimensions.h = data.containers[0].stack.containerStackValue.dz / 100;
        containerDimensions.l = data.containers[0].stack.containerStackValue.dy / 100;
        containerDimensions.capacity = 0;

        //remove all the truck and the packs added
        updateScene("all");

        //create the container
        new Container(containerDimensions.w, containerDimensions.h, containerDimensions.l, containerDimensions.capacity);
        new DragSurface(containerDimensions.w, containerDimensions.h, containerDimensions.l);
        containerCreated = true;

        const packer = data.containers[0].stack.placements.map((item, i) => {
            const label = item.stackable.id;
            const x = item.absoluteX;
            const y = item.absoluteZ;
            const z = item.absoluteY;
            const w = item.stackValue.dx;
            const h = item.stackValue.dz;
            const l = item.stackValue.dy;
            const v = w * h * l;

            const pack = new Pack(label, w / 100, h / 100 , l / 100, 1, -1, ["base"], 2, [])
            pack.add()

            return {
                id: `${i}`,
                label,
                w,
                h,
                l,
                v,
                x,
                z,
                y,
                priority: 2,
                stackC: -1,
                rotations: [
                    {
                        w: w,
                        h: h,
                        l: l,
                        type: [
                            'base', 0
                        ],
                        survey: 31232
                    },
                    {
                        w: l,
                        h: h,
                        l: w,
                        type: [
                            'base', 90
                        ],
                        survey: 31232
                    },
                ],
                rotateDirections: ['base'],
                multiplePrio: false,
                subQuantities: [],
                color: pack.color,
                parent_id: i,
                validRotation: [ 'base', 0 ],
                openPoint: {
                    R: {
                        x: 0,
                        y: 0,
                        z: l,
                    },
                    T: {
                        x: 0,
                        y: h,
                        z: 0,
                    },
                    F: {
                        x: w,
                        y: 0,
                        z: 0,
                    }
                }
            }
        })

            loadPacksInstanced([], packer)

            $("#numberBox").attr("max", packer.length);
            $("#numberBox").val(packer.length);

            console.log(breakPoints)
            index = boxInstances.length - 1
            lastNum = breakPoints.length == 0 ? boxInstances[index - 1].count : breakPoints.reduce((partialSum, a) => partialSum + a.count, 0) + 1;

            $(".scene-player").removeClass("hidden")

    })

    //change to the manuelle mode
    let stat = false;
    $("#switchManuelleMode").click(function () {
        if (!containerCreated) {
            showErrorMessage("Please create the container")
            return;
        }

        if (Pack.allInstances.length == 0) {
            showErrorMessage("Please add some packages")
            return;
        }

        updateScene("loadedPacks");
        $(".menu").toggleClass("openMenu closeMenu");
        $(".menuIcon").toggleClass("openMenuIcon closeMenu");
        $(".dragDrop-container").toggleClass("hidden");
        $(".scene-player").addClass("hidden")

        Pack.reloadShowPacker();

        stat = !stat;
        $("#solve").toggleClass("disabled")
        //change the mode of app from auto fill to manuelle fill
        DragSurface.switch(stat)

    });

    //load the packages from the localstorage if not empty
    Pack.loadPacksFromLocalStorage();

    //click event on the update button to update a specific pack
    $("#updatePack").click(function (event) {
        event.preventDefault();

        var packDetails = {};
        packDetails.id = $("#pack_Detail_Id").val();
        packDetails.label = $("#pack_Detail_Label").val();
        packDetails.w = $("#pack_Detail_Width").val() * scale_meter_px;
        packDetails.h = $("#pack_Detail_Height").val() * scale_meter_px;
        packDetails.l = $("#pack_Detail_Lenght").val() * scale_meter_px;
        packDetails.q = $("#pack_Detail_Quantity").val();
        packDetails.stack = $("#pack_Detail_StackingCapacity").val();
        packDetails.priority = $("#pack_Detail_Priority").val();

        packDetails.r = ["base"];
        //rotation
        if ($('#pack_Detail_right-side').is(":checked")) {
            packDetails.r.push("right-side")
        }
        if ($('#pack_Detail_front-side').is(":checked")) {
            packDetails.r.push("front-side")
        }

        //add/update the list of of multiple priorities
        let quantities = getMultipleInputValues(".sub-q");
        let priorities = getMultipleInputValues(".sub-prio");
        let subQuantities = [];

        for (let i = 0; i < quantities.length; i++) {
            let q = quantities[i];
            let p = priorities[i];

            subQuantities.push({
                n: q,
                p: p
            });
        }

        packDetails.subQuantities = subQuantities;

        Pack.update(packDetails, packDetails.id);
        Pack.removeBoxesFromTheScene();
        Pack.loadPacks();

    });

    //get the array of values inserted by the user
    function getMultipleInputValues(className) {
        let inputs = $(className);
        let values = [];

        for (let i = 0; i < inputs.length; i++) {
            let input = inputs[i];
            values.push(parseInt(input.value));
        }

        return values;
    }

    //click event on the delete button to remove a specific pack
    $("#deletePack").click(function (event) {
        event.preventDefault();

        let id = $("#pack_Detail_Id").val();
        Pack.remove(id);
        Pack.removeBoxesFromTheScene();
        Pack.loadPacks();
    });

    // csv section
    // load data from csv file
    $("#actual-btn").change((e) => readCsv(e, $("#actual-btn").val().split(".").pop().toLowerCase()));


    $("#numberBox").on("input", function (e) {

        if (e.target.value != null && boxInstances.length > 0) {
            let boxes = boxInstances[index - 1]
            let linesGeometry = boxInstances[index]

            if (lastNum < e.target.value) {
                console.log("increasing");

                boxes.count = ++boxes.count
                linesGeometry.instanceCount = boxes.count

                if (breakPoints.includes(parseInt(e.target.value))) index += 2;
            }
            else {
                console.log("decreasing");
                boxes.count = --boxes.count
                linesGeometry.instanceCount = boxes.count

                if (breakPoints.includes(parseInt(e.target.value))) index -= 2;
            }

            lastNum = e.target.value;
        }
    });

    // load data from api
    $("#loadApi").click(() => loadApi($("#apiUrl").val()));

    //fill the form with random numbers to make the things fast and easy
    $("#random").click(function () {
        $("#packLabel").val("colis " + Math.floor((Math.random() * 100)));
        $("#packWidth").val(Math.floor((Math.random() * (2 - 0.1 + 1) + 0.1) * 100) / 100);
        $("#packHeight").val(Math.floor((Math.random() * (2 - 0.1 + 1) + 0.1) * 100) / 100);
        $("#packLenght").val(Math.floor((Math.random() * (2 - 0.1 + 1) + 0.1) * 100) / 100);
        $("#packQuantity").val(Math.floor((Math.random() * 20) + 1));
    });
});

function playScene(value) {

    // console.log(value)
    if (value != null && boxInstances.length > 0) {
        let boxes = boxInstances[index - 1]
        let linesGeometry = boxInstances[index]

        console.log(lastNum, value)
        if (lastNum < value) {
            console.log("increasing");

            boxes.count = ++boxes.count
            linesGeometry.instanceCount = boxes.count

            if (breakPoints.includes(parseInt(value))) index += 2;
        }
        else {
            console.log("decreasing");
            boxes.count = --boxes.count
            linesGeometry.instanceCount = boxes.count

            console.log(boxes.count)
            if (breakPoints.includes(parseInt(value))) index -= 2;
        }

        lastNum = value;
    }
}

var speed = 200;
var myInterval;
var direction = "backward";

function play() {

    let numberBox = $("#numberBox");
    let numberBoxValue = parseInt(numberBox.val());
    let numberBoxMax = parseInt(numberBox.attr("max"));

    // console.log(numberBoxValue, numberBoxMax)
    myInterval = setInterval(() => {

        // console.log("hello")
        if (direction == "backward" && numberBoxValue >= 1) {
            $(`#play-forward`).removeClass("disabled")
            numberBox.val(--numberBoxValue)
            playScene(numberBoxValue)
        }

        if (direction == "forward" && numberBoxValue < numberBoxMax) {
            $(`#play-backward`).removeClass("disabled")
            numberBox.val(++numberBoxValue)
            playScene(numberBoxValue)
        }

        if (direction == "backward" && numberBoxValue < 1) {
            $("#play-pause").attr("role", "pause")
            $("#play-pause").toggleClass("fa-circle-play fa-circle-pause")

            $(`#play-${direction}`).toggleClass("disabled", true)
            $(`#play-${direction}`).toggleClass("scene-player--active")

            direction = "forward"
            numberBox.val(0)
            lastNum = -1
            $(`#play-${direction}`).toggleClass("scene-player--active", true)

            pause()
        }

        if (direction == "forward" && numberBoxValue >= numberBoxMax) {
            $("#play-pause").attr("role", "pause")
            $("#play-pause").toggleClass("fa-circle-play fa-circle-pause")

            $(`#play-${direction}`).toggleClass("disabled", true)
            $(`#play-${direction}`).toggleClass("scene-player--active")

            direction = "backward"
            $(`#play-${direction}`).toggleClass("scene-player--active", true)
            pause()
        }

    }, speed);
}

function pause() {
    clearInterval(myInterval)
}

function changeSceneDirection(dir) {
    $(`#play-${dir}`).toggleClass("scene-player--active", true)
    $(`#play-${direction}`).toggleClass("scene-player--active", false)

    direction = dir
}

$("#increase-speed").click(function () {
    console.log(speed)
    if (speed <= 500)
        speed += 50
})

$("#decrease-speed").click(function () {
    console.log(speed)

    if (speed >= 1)
        speed -= 50
})

$("#play-backward").click(function () {
    changeSceneDirection("backward")
})

$("#play-forward").click(function () {
    changeSceneDirection("forward")
})

//play with the scene using the controlls
//like video controlls
$("#play-pause").on("click", function () {
    $(this).toggleClass("fa-circle-play fa-circle-pause")
    let role = $(this).attr("role");

    if (role == "play") {
        $(this).attr("role", "pause")
        role = "pause"
    }
    else {
        $(this).attr("role", "play")
        role = "play"
    }

    if (role == "play") play();
    else pause();
})

//generate the pdf file
$(document).on('click', '#exportPdf', function () {
    generatePDF()
})

// $("#exportPdf").on('click', 'b', function () {
//     console.log("generate the pdf")
//     generatePDF();
// })

//this export is used for testing 
export { loadApi, readCsv }


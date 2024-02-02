import { FreeAtHome, PairingIds } from "@busch-jaeger/free-at-home";
import { ScriptingAPI as API } from "@busch-jaeger/free-at-home";
import { ScriptingHost as Addons } from "@busch-jaeger/free-at-home";
import { UMRConnect } from "nodejs-wth-umr-connect";
import {RoomTemperatureControllerChannelExt} from "./RoomTemperatureControllerChannelExt";
import { json } from "stream/consumers";

let dictThermostats = new Map<number, any>();
var timer = (ms:any) => new Promise( (res:any) => setTimeout(res, ms));

type RunConfig = {
  tID: number;
  bOn: boolean|undefined; 
  bEco: boolean|undefined;
  nT: number|undefined;
}
var ThermostatRunConfig: Array<RunConfig> = [];

export interface UMRConfigurationProperties extends API.Configuration {
    default: {
        items: {
            UMR: string,
            TEMP_ECO: number,
            TEMP_OFF: number,
            RefreshInt: number,
            Config: string
        }
    },
};

const metaData = Addons.readMetaData();
const addons = new Addons.AddOn<UMRConfigurationProperties>(metaData.id);
var cfgProp:UMRConfigurationProperties;

addons.on("configurationChanged", (configuration: UMRConfigurationProperties) => {  
  
  if(configuration.default.items.UMR == undefined)
  {
    configuration.default.items.UMR = "umr_2";
  }
  if(configuration.default.items.TEMP_ECO == undefined)
  {
    configuration.default.items.TEMP_ECO = 16;
  }
  if(configuration.default.items.TEMP_OFF == undefined)
  {   
    configuration.default.items.TEMP_OFF = 8;
  }
  if(configuration.default.items.RefreshInt == undefined)
  {
    configuration.default.items.RefreshInt = 1;
  }
  if(configuration.default.items.Config == undefined)
  {
    configuration.default.items.Config = "";
  }
  cfgProp = configuration;
});

function updateSysApStatusConfig()
{
  try
  {
    var b64data = JSON.stringify(ThermostatRunConfig);
    if(cfgProp.default.items.Config != b64data)
    {
      cfgProp.default.items.Config = b64data;
      addons.setConfiguration(cfgProp);
    }
  }catch(error)
  {
    console.log(`Unable to update config: ${error}`);
  }

}

function getThermostatConfigByNumber(ThermostatNumber:number):RunConfig
{
  var oTsRunCfg:RunConfig|undefined;

  try
  {
    ThermostatRunConfig = JSON.parse(cfgProp.default.items.Config);
  }
  catch(error)
  {
      console.log(`Unable to process STATUS json: ${error}`);
  }

  ThermostatRunConfig.forEach(tsRunCfg => 
  {
    if(tsRunCfg.tID == ThermostatNumber)
    {
      //console.log("FoundCfg: " + ThermostatNumber);
      oTsRunCfg = tsRunCfg;
      return oTsRunCfg;
    }    
  })

  if(oTsRunCfg == undefined)
  {
    //console.log("CreateNewCfg: " + ThermostatNumber);
    oTsRunCfg = {
      tID: ThermostatNumber,
      bOn: undefined,
      bEco: undefined,
      nT: undefined
    };
    ThermostatRunConfig.push(oTsRunCfg);
    updateSysApStatusConfig();
  }
  
  return oTsRunCfg;
}

//Creating thermostat using custom template, 
//Pull request https://github.com/Busch-Jaeger/node-free-at-home/pull/4 is not going through, so lib does not have correct datapoints for RTC.
//Implemented local version of the RTC to overcome incomplete implementation of the RTC in the API.
async function createRoomTemperatureControllerDeviceExt(FahConnection:any, nativeId: string, name: string): Promise<RoomTemperatureControllerChannelExt> {
  const device = await FahConnection.freeAtHomeApi.createDevice("RTC", nativeId, name);
  const channel = device.getChannels().next().value;
  return new RoomTemperatureControllerChannelExt(channel);
}

async function CreateNewThermostat(thermostatID:number, InitialSetPoint:number, dict:any, FahConnection:any, UMR:any)
{
    console.log("Creating device" + thermostatID);
    var RTCChannel = await createRoomTemperatureControllerDeviceExt(FahConnection, "UMR_RT" + thermostatID, "UMR Thermostat " + thermostatID);
    RTCChannel.setAutoKeepAlive(true);
    RTCChannel.setAutoConfirm(true);
    console.log("SetPoint: " + RTCChannel.getSetPointTemperature());
    RTCChannel.on('onSetPointTemperatureChanged', (value) => {
        console.log("Setpoint: " + thermostatID + "-->" + value );
        getThermostatConfigByNumber(thermostatID).nT = value;
        updateSysApStatusConfig();
        UMR.ThermostatNewSetpoint(thermostatID, value);        
    });
    RTCChannel.on('onDeviceEcoModeChanged', (value) => {
        console.log("EcoMode: " + thermostatID + "-->" + value );        
        if(value)
        {
            UMR.SetEco(thermostatID);
            getThermostatConfigByNumber(thermostatID).bEco = true;
            updateSysApStatusConfig();    
        }
        else
        {
            var trc = getThermostatConfigByNumber(thermostatID);
            if(trc.tID != undefined)
            {
              UMR.SetEcoEnds(thermostatID, trc.tID);
            }
            else
            {
              UMR.SetEcoEnds(thermostatID, RTCChannel.getSetPointTemperature());
            }
            trc.bEco = false;
            updateSysApStatusConfig();
        }
    });

    RTCChannel.on('onDeviceOnOffModeChanged', (value) => {
        console.log("DeviceIsOn: " + thermostatID + "-->" + value );
        if(value)
        {
            var trc = getThermostatConfigByNumber(thermostatID);
            if(trc.nT != undefined)
            {
              UMR.SetOn(thermostatID, trc.nT);
            }
            else
            {
              UMR.SetOn(thermostatID, RTCChannel.getSetPointTemperature());
            }
            trc.bOn = true;
            updateSysApStatusConfig();
        }
        else
        {
            getThermostatConfigByNumber(thermostatID).bOn = false;
            updateSysApStatusConfig();  
            UMR.SetOff(thermostatID);
        }
    });
    
    await RTCChannel.start();
    dict.set(thermostatID, RTCChannel);

    var tsCfg = getThermostatConfigByNumber(thermostatID);
    if(tsCfg.bEco != undefined && tsCfg.bEco)
    {
      UMR.SetEco(thermostatID);
    }
    else if(tsCfg.bOn != undefined && !tsCfg.bOn)    
    {
      UMR.SetOff(thermostatID);
    }
    else if(tsCfg.nT != undefined)
    {
      UMR.ThermostatNewSetpoint(thermostatID, tsCfg.nT);
    }
    //console.log("Done Creating device" + number);
}

async function main()
{   
    console.log("UMR FAH Connector Starting");
    var freeAtHome = new FreeAtHome();
    freeAtHome.activateSignalHandling();

    await addons.connectToConfiguration();
    await timer(2000);    
    console.log("FAH initialization completed");

    var count = 0;
    while(freeAtHome.freeAtHomeApi.getConnectionState() != 1)
    {
      count++;
      console.log("Not connected: " + freeAtHome.freeAtHomeApi.getConnectionState());
      if(count > 10)
      {
        console.error("Failing on connection to FaH");
        process.exit();
        return;
      }
      await timer(2000);
    }

    var UMR = new UMRConnect();
    freeAtHome.setEnableLogging(true)

    if(cfgProp.default.items.UMR != "")
    {
        console.log("Using Configured UMR2 Hostname: " + cfgProp.default.items.UMR);
        UMR.SetHostname(cfgProp.default.items.UMR);
    }
    if(cfgProp.default.items.TEMP_ECO != 0)
    {
        console.log("Using Configured ECO Temp: " + cfgProp.default.items.TEMP_ECO);
        UMR.UMR_ECO_TEMPERATURE = cfgProp.default.items.TEMP_ECO;
    }
    if(cfgProp.default.items.TEMP_OFF != 0)
    {
        console.log("Using Configured OFF Temp: " + cfgProp.default.items.TEMP_OFF);
        UMR.UMR_OFF_TEMPERATURE = cfgProp.default.items.TEMP_OFF;
    }
    if(cfgProp.default.items.RefreshInt != 0)
    {
        console.log("Using Configured Refresh interval: " + cfgProp.default.items.RefreshInt);
        UMR.updateInterval = cfgProp.default.items.RefreshInt * 60;
    }
    else
    {
        UMR.updateInterval = 60;
    }
    UMR.newDeviceNotificatonInterval = 5;    

    /*const RTCChannel = await freeAtHome.createRoomTemperatureControllerDevice("UMR_RT4", "UMR Thermostat");
    RTCChannel.setAutoKeepAlive(true);
    RTCChannel.on('onSetPointTemperatureChanged', (value) => {
        console.log("Setpoint: " + value );
    });
    RTCChannel.start(8);
    RTCChannel.sendMeasuredTemperature(18.5);
    */

    UMR.on('onNewUMRDetected',(thermostat, InitialSetPoint) => {        
        console.log("NewDetect: " + thermostat );
        CreateNewThermostat(thermostat, InitialSetPoint, dictThermostats, freeAtHome, UMR);
      });
    
      UMR.on("onUMREcoChanged", (thermostat, eco) => {
        console.log("IsEco: " + thermostat  + " " + eco);        
        dictThermostats.get(thermostat).setEcoState(eco);
      });
    
      UMR.on("onUMROnOffChanged", (thermostat, ison) => {
            console.log("IsOn: " + thermostat  + " " + ison);
            dictThermostats.get(thermostat).setOnState(ison);
      });
    
      UMR.on("onUMRSetPointChanged", (thermostat, setpoint) => {
          getThermostatConfigByNumber(thermostat).nT = setpoint;
          updateSysApStatusConfig();
          console.log("Setpoint: " + thermostat  + " " + setpoint);
          dictThermostats.get(thermostat).sendSetPointTemperature(setpoint);
      });
    
      UMR.on("onUMRMessuredTemperatureChanged", (thermostat, temperature) => {
        console.log("Temperature: " + thermostat  + " " + temperature);
        dictThermostats.get(thermostat).sendMeasuredTemperature(temperature);
      });    

      UMR.on("onUMRHeatIsActiveChanged", (thermostat, state) => {
        console.log("HeatingActive: " + thermostat  + " " + state);
        dictThermostats.get(thermostat).setIsHeating(state);
      });    

      UMR.on("onUMRCoolingIsActiveChanged", (thermostat, state) => {
        console.log("CoolingActive: " + thermostat  + " " + state);
        dictThermostats.get(thermostat).setIsCooling(state);
      });    

      var t = await UMR.Start();
      console.log("Started");  
}

try
{
    main();    
}
catch (error)
{ 
  console.error(error);
}
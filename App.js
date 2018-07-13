import React from 'react';
import { Alert, AppRegistry, StyleSheet, Text, View, Switch, StatusBar, ImageBackground, TouchableOpacity, AsyncStorage, NetInfo, Platform } from 'react-native';

import BackgroundGeolocation from "react-native-background-geolocation";

export default class App extends React.Component {
  constructor() {
    super();

    this.state = {
      lat: 0.0,
      long: 0.0,
      time: 0,
      uuid: "null",
      numCached: 0,
      connection: "none",
      platform: Platform.OS,
      isTracking: true
    };
  }
  
  componentWillMount() {
    ////
    // 1.  Wire up event-listeners
    //

    // This handler fires whenever bgGeo receives a location update.
    BackgroundGeolocation.on('location', this.onLocation, this.onError);

    // This handler fires when movement states changes (stationary->moving; moving->stationary)
    BackgroundGeolocation.on('motionchange', this.onMotionChange);

    // This event fires when a change in motion activity is detected
    BackgroundGeolocation.on('activitychange', this.onActivityChange);

    // This event fires when the user toggles location-services authorization
    BackgroundGeolocation.on('providerchange', this.onProviderChange);

    BackgroundGeolocation.ready({
      desiredAccuracy: 10,
      distanceFilter: 5,
      logLevel: BackgroundGeolocation.LOG_LEVEL_VERBOSE,
      stopOnTerminate: false,
      startOnBoot: true,
    }, (state) => {
      console.log("- BackgroundGeolocation is configured and ready: ", state.enabled);

      if(!state.enabled) {
        BackgroundGeolocation.start(function() {
          console.log("- Start success");
        });
      }
    });
  }

  componentWillUnmount() {
    BackgroundGeolocation.removeListeners();
  }

  onLocation(location) {
    console.log('- [event] location: ', location);
  }
  onError(error) {
    console.warn('- [event] location error ', error);
  }
  onActivityChange(activity) {
    console.log('- [event] activitychange: ', activity);  // eg: 'on_foot', 'still', 'in_vehicle'
  }
  onProviderChange(provider) {
    console.log('- [event] providerchange: ', provider);    
  }
  onMotionChange(location) {
    console.log('- [event] motionchange: ', location.isMoving, location);
  }

  componentDidMount() {
    NetInfo.addEventListener('connectionChange', this._setConnection.bind(this));
  }

  _setConnection(NetInfo) {
    this.setState({connection: NetInfo.type})
  }

  async initStorage() {
    await AsyncStorage.setItem('lats', '&lats=')
    await AsyncStorage.setItem('lons', '&lons=')
    await AsyncStorage.setItem('times', '&times=')
  }

  async getUUID() {
    {/*For testing purposes: AsyncStorage.removeItem("uuid");*/}

    var storedUUID = await AsyncStorage.getItem("uuid");
    if (storedUUID !== "null" && storedUUID !== null) {
      console.log("use pre-existing uuid")
      this.setState({uuid: storedUUID})
    }
    else {
      console.log("request new uuid")
      {/*Get UUID from server*/}
      await fetch('https://bhiqp.ky8.io/reg', {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: 'appkey=9355552b2db866c13b123333d10603007101597ea87b75eb3ebb370c7748fb81&os='.concat(this.state.platform),
        method: 'POST'
      })
      .then((response) => response.json())
      .then((response) => this.setState({uuid: response.uuid}))
      .catch(error => console.error(error));

      await AsyncStorage.setItem('uuid', this.state.uuid)
      await AsyncStorage.setItem('lats', '&lats=')
      await AsyncStorage.setItem('lons', '&lons=')
      await AsyncStorage.setItem('times', '&times=')
    }
  }

  uuidret = this.getUUID();
  storageret = this.initStorage();

  watchID = BackgroundGeolocation.watchPosition(async (position) => {
    {/*Check is user in within park bounds and allows tracking*/}
    if ((this.state.isTracking) && (position.coords.longitude < -68.162249) && (position.coords.longitude > -68.432787)
        && (position.coords.latitude < 44.448252) && (position.coords.latitude > 44.218395)) {
      this.setState({
        lat: position.coords.latitude,
        long: position.coords.longitude,
        time: Math.floor(new Date().getTime() / 1000),
      });

      {/*Send data if phone has wifi*/}
      if (this.state.connection == "wifi") {
        fetch('https://bhiqp.ky8.io/report', {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: 'uuid='.concat(this.state.uuid,'&time=', this.state.time, '&lat=', this.state.lat, '&lon=', this.state.long),
          method: 'POST'
        })
        .then(async (response) => {
          if (response.status == 401) {
            this.setState({
              uuid: "null"
            })   
            this.getUUID()
          }
          if (response.status != 200 ) {
            {/*If data send failed, cache data to send later*/}
            {/*Store*/}
            if (this.state.numCached === 0) {
              var oldlats = await AsyncStorage.getItem('lats')
              var oldlons = await AsyncStorage.getItem('lons')
              var oldtimes = await AsyncStorage.getItem('times')
    
              var newlats = oldlats.concat(JSON.stringify(this.state.lat))
              var newlons = oldlons.concat(JSON.stringify(this.state.long))
              var newtimes = oldtimes.concat(JSON.stringify(this.state.time))
    
              await AsyncStorage.setItem('lats', newlats)
              await AsyncStorage.setItem('lons', newlons)
              await AsyncStorage.setItem('times', newtimes)
            }
            else {
              var oldlats = await AsyncStorage.getItem('lats')
              var oldlons = await AsyncStorage.getItem('lons')
              var oldtimes = await AsyncStorage.getItem('times')
    
              var newlats = oldlats.concat(',', JSON.stringify(this.state.lat))
              var newlons = oldlons.concat(',', JSON.stringify(this.state.long))
              var newtimes = oldtimes.concat(',', JSON.stringify(this.state.time))
    
              await AsyncStorage.setItem('lats', newlats)
              await AsyncStorage.setItem('lons', newlons)
              await AsyncStorage.setItem('times', newtimes)
            }
            {/*Increase count of cached points*/}
            this.setState({
              numCached: this.state.numCached + 1
            })            
          }
        })
        .catch(error => console.error(error));

        {/*Send any stored data*/}
        if(this.state.numCached > 0) {
          {/*Send batch*/}
          var lats = await AsyncStorage.getItem('lats')
          var longs = await AsyncStorage.getItem('lons')
          var times = await AsyncStorage.getItem('times')
          fetch('https://bhiqp.ky8.io/batch_report', {
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: 'uuid='.concat(this.state.uuid, times, lats, longs),
            method: 'POST'
          })
          .then(async (response) => {
            if (response.status == 200) {
              {/*Data is sent, cache can be cleared*/}
              await AsyncStorage.setItem('lats', '&lats=')
              await AsyncStorage.setItem('lons', '&lons=')
              await AsyncStorage.setItem('times', '&times=')
    
              this.setState({
                numCached: 0
              })
            }
            else if (response.status == 401) {
              {/*UUID is invalid, get a new one*/}
              this.setState({
                uuid: "null"
              })   
              this.getUUID()
            }
          })
          .catch(error => console.error(error));
        }

      }
      else if (this.state.connection == "cell"){
        {/*Store*/}
        if (this.state.numCached === 0) {
          var oldlats = await AsyncStorage.getItem('lats')
          var oldlons = await AsyncStorage.getItem('lons')
          var oldtimes = await AsyncStorage.getItem('times')

          var newlats = oldlats.concat(JSON.stringify(this.state.lat))
          var newlons = oldlons.concat(JSON.stringify(this.state.long))
          var newtimes = oldtimes.concat(JSON.stringify(this.state.time))

          await AsyncStorage.setItem('lats', newlats)
          await AsyncStorage.setItem('lons', newlons)
          await AsyncStorage.setItem('times', newtimes)
        }
        else {
          var oldlats = await AsyncStorage.getItem('lats')
          var oldlons = await AsyncStorage.getItem('lons')
          var oldtimes = await AsyncStorage.getItem('times')

          var newlats = oldlats.concat(',', JSON.stringify(this.state.lat))
          var newlons = oldlons.concat(',', JSON.stringify(this.state.long))
          var newtimes = oldtimes.concat(',', JSON.stringify(this.state.time))

          await AsyncStorage.setItem('lats', newlats)
          await AsyncStorage.setItem('lons', newlons)
          await AsyncStorage.setItem('times', newtimes)
        }
        
        {/*Increase count of cached points*/}
        this.setState({
          numCached: this.state.numCached + 1
        })

        {/*Send cache if it contains 25 data points*/}
        if (this.state.numCached > 24) {
          {/*Send batch*/}
          lats = await AsyncStorage.getItem('lats')
          longs = await AsyncStorage.getItem('lons')
          times = await AsyncStorage.getItem('times')
          fetch('https://bhiqp.ky8.io/batch_report', {
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: 'uuid='.concat(this.state.uuid, times, lats, longs),
            method: 'POST'
          })
          .then(async (response) => {
            if (response.status == 200) {
              {/*Data is sent, cache can be cleared*/}
              await AsyncStorage.setItem('lats', '&lats=')
              await AsyncStorage.setItem('lons', '&lons=')
              await AsyncStorage.setItem('times', '&times=')
    
              this.setState({
                numCached: 0
              })
            }
            else if (response.status == 401) {
              {/*UUID is invalid, get a new one*/}
              this.setState({
                uuid: "null"
              })   
              this.getUUID()
            }
          })
          .catch(error => console.error(error));
        }
      }
        
      else {
        {/*Store*/}
        if (this.state.numCached === 0) {
          var oldlats = await AsyncStorage.getItem('lats')
          var oldlons = await AsyncStorage.getItem('lons')
          var oldtimes = await AsyncStorage.getItem('times')

          var newlats = oldlats.concat(JSON.stringify(this.state.lat))
          var newlons = oldlons.concat(JSON.stringify(this.state.long))
          var newtimes = oldtimes.concat(JSON.stringify(this.state.time))

          await AsyncStorage.setItem('lats', newlats)
          await AsyncStorage.setItem('lons', newlons)
          await AsyncStorage.setItem('times', newtimes)
        }
        else {
          var oldlats = await AsyncStorage.getItem('lats')
          var oldlons = await AsyncStorage.getItem('lons')
          var oldtimes = await AsyncStorage.getItem('times')

          var newlats = oldlats.concat(',', JSON.stringify(this.state.lat))
          var newlons = oldlons.concat(',', JSON.stringify(this.state.long))
          var newtimes = oldtimes.concat(',', JSON.stringify(this.state.time))

          await AsyncStorage.setItem('lats', newlats)
          await AsyncStorage.setItem('lons', newlons)
          await AsyncStorage.setItem('times', newtimes)
        }

        {/*Increase count of cached points*/}
        this.setState({
          numCached: this.state.numCached + 1
        })
      }

    }
  },
  (error) => console.error(error),
  {interval: 1500, desiredAccuracy: 0, persist: false})
 
  render() {

    var b1Text = Platform.OS === 'ios' ? styles.iOSB1Text : styles.androidB1Text;
    var b2 = Platform.OS === 'ios' ? styles.iOSB2 : styles.androidB2;
    //lat and long label
    var b2TextLeft = Platform.OS === 'ios' ? styles.iOSB2TextLeft : styles.androidB2TextLeft;
    //lat and long values
    var b2TextRight = Platform.OS === 'ios' ? styles.iOSB2TextRight : styles.androidB2TextRight;
    var b3Text = Platform.OS === 'ios' ? styles.iOSB3Text : styles.androidB3Text;


    {/*Print position to the screen*/}
    return (

      <View style={styles.container}>

        <View style={styles.statusBar}>
          <StatusBar/>
        </View>

        <ImageBackground
          style={styles.imageBg}
          source={require('./Images/acadia-national-park-maine.jpg')}
          blurRadius={Platform.OS === 'ios' ? 5 : 1}
        >

          <View style={styles.headerView}>
            <Text style = {styles.headerText}>
              {'Acadia Traffic Data Collection'}
            </Text>
          </View>

          <View style={styles.b1}>
            <Text style={b1Text}>
              This application will help Acadia National Park officials decrease the park's heavy traffic and
              make visiting the park with a vehicle a less stressful experience.
              We appreciate your support in making Acadia safer and preserving its incredible beauty.
            </Text>
          </View>

          <View style={b2}>
            <Text style={b2TextLeft}>
              Latitude:{'\n'}
              Longitude:
            </Text>
            <Text style={b2TextRight}>
              {this.state.lat.toFixed(6)}{'\n'}
              {this.state.long.toFixed(6)}{'\n'}
            </Text>
          </View>

          <View style={styles.b3}>
            <Text style={b3Text}>Allow Tracking</Text>
            <Switch
              style={styles.switch}
              value={this.state.isTracking}
              onValueChange={(value) => this.setState({isTracking: value})}
            />
          </View>

          <TouchableOpacity
            style={styles.optBtn}
            onPress={() => {
              Alert.alert (
                'Warning',
                'Are you sure you want to permenantly delete all the data your phone has collected?',
                [
                  {text: 'Cancel'},
                  {text: 'OK', onPress: () =>
                    fetch('https://bhiqp.ky8.io/delete', {
                      headers: {
                        'Content-Type': 'application/x-www-form-urlencode'
                      },
                      body: 'uuid='.concat(this.state.uuid),
                      method:'POST',
                    })
                    .then(response => this.state)
                    .catch(error => console.error(error))
                  }
                ]
              );
            }}
          >
            <Text style={styles.optBtnText}>Delete Tracking Data</Text>
          </TouchableOpacity>
        </ImageBackground>
      </View>
    );
  }
}

AppRegistry.registerComponent('App', () => App);

//b1 representing blur box 1 (top)
const styles = StyleSheet.create({

  container: {
    flex: 1,
  },
  
  statusBar: {
    height: Platform.OS === 'ios' ? 20 : StatusBar.currentHeight,
    backgroundColor: '#4885ed'
  },

  imageBg: {
    flexGrow: 1,
    height: null	,
    width: null,
    alignItems: 'center',
    justifyContent: 'center',
  },

  headerView: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 56,
    justifyContent: 'center',
    backgroundColor: '#4885ed'
  },

  headerText: {
    position: 'absolute',
    top: 15,
    left: 20,
    color: '#fff',
    alignContent: 'flex-start',
    fontSize: Platform.OS === 'ios' ? 20 : 25,
    justifyContent: 'center',
  },

  b1: {
    position: 'absolute',
    top: 90,
    left: 10,
    right: 10,
    height: 230,
    backgroundColor: '#3d3c3c9f',
    borderWidth: 0.5,
    borderRadius: 2,
    borderColor: '#282828'
  },

 androidB1Text: {
    position: 'absolute',
    top: 20,
    left: 20,
    right: 20,
    color: '#fff',
    textAlign:'left',
    justifyContent: 'center',
    alignItems: 'center',
    fontSize: 25,
  },

  iOSB1Text:{
    color:'#fff',
    textAlign:'left',
    justifyContent: 'center',
    alignItems: 'center',
    fontSize: 21,
    borderLeftWidth: 20,
    borderRightWidth: 20,
    borderTopWidth: 16,
    borderBottomWidth: 20,
  },

  iOSB2: {
    position: 'absolute',
    top: 356,
    left: 10,
    right: 10,
    height: 80,
    backgroundColor: '#3d3c3c9f',
    borderWidth: 0.5,
    borderRadius: 2,
    borderColor: '#282828',
    justifyContent: 'center',
    alignContent: 'center'
  },

  androidB2: {
    position: 'absolute',
    top: 363,
    left: 10,
    right: 10,
    height: 80,
    backgroundColor: '#3d3c3c9f',
    borderWidth: 0.5,
    borderRadius: 2,
    borderColor: '#282828',
    justifyContent: 'center',
    alignContent: 'center'
  },

  iOSB2TextLeft: {
    color: '#fff',
    textAlign:'right',
    justifyContent: 'center',
    alignItems: 'center',
    fontSize: 21,
    position: 'absolute',
    left: 70,
    top: 15,
  },

  androidB2TextLeft: {
    color: '#fff',
    textAlign:'left',
    justifyContent: 'center',
    alignItems: 'center',
    fontSize: 25,
    position: 'absolute',
    left: 20,
    top: 15,
  },

  iOSB2TextRight: {
    color:'#fff',
    textAlign:'right',
    justifyContent: 'center',
    alignItems: 'center',
    fontSize: 21,
    position: 'absolute',
    right: 105,
    top: 15,
  },

  androidB2TextRight: {
    color: '#fff',
    textAlign:'right',
    justifyContent: 'center',
    alignItems: 'center',
    fontSize: 25,
    position: 'absolute',
    right: 20,
    top: 15,
  },

  b3: {
    position: 'absolute',
    right: 10,
    left: 10,
    height: 60,
    bottom: 115,
    backgroundColor: '#3d3c3c9f',
    borderWidth: 0.5,
    borderRadius: 2,
    borderColor: '#282828',
    justifyContent: 'center',
    alignContent: 'center'
  },

  iOSB3Text: {
    color:'#ffffff',
    fontSize: 21,
    alignItems: 'center',
    justifyContent: 'center',
    borderLeftWidth: 20,
  },

  androidB3Text: {
    position: 'absolute',
    left: 20,
    color:'#ffffff',
    fontSize: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },

  switch: {
    position: 'absolute',
    right: 20,
  },

  optBtn: {
    position: 'absolute',
    bottom: 20,
    height: 60,
    left: 10,
    right: 10,
    backgroundColor: '#db3236',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 45
  },

  optBtnText: {
    justifyContent: 'center',
    alignItems: 'center',
    fontSize: Platform.OS === 'ios' ? 20 : 25,
    color: '#ffffff'
  }
});

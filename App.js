import React from 'react';
import { Alert, AppRegistry, AppState, StyleSheet, Text, View, Switch, StatusBar, ImageBackground, TouchableOpacity, AsyncStorage, NetInfo, Platform } from 'react-native';

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
      distanceFilter: 10,
      logLevel: BackgroundGeolocation.LOG_LEVEL_VERBOSE,
      stopOnTerminate: true,
      startOnBoot: false,
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
    AppState.removeEventListener('change', this._handleAppStateChange);
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
    AppState.addEventListener('change', this._handleAppStateChange);
  }

  _setConnection(NetInfo) {
    this.setState({connection: NetInfo.type})
  }

  _handleAppStateChange = (newAppState) => {
    if (newAppState === 'active' || newAppState === 'background') {
      BackgroundGeolocation.start(function() {
        console.log("- Start success");
      });
    };
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
    }
  }

  uuidret = this.getUUID();
  storageret = this.initStorage();

  watchID = BackgroundGeolocation.watchPosition(async (position) => {
    console.log("thisisissis: ", this.state.uuid)
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

    return (
  
      <View style={styles.container}>
  
        <View style={styles.statusBar}>
          <StatusBar/>
        </View>
  
        <View style={styles.headerView}>
  
          <Text style = {styles.headerText}>
            {'Acadia Traffic Solutions'}
          </Text>
  
        </View>
  
        <View style = {styles.infoPara}>
          <Text style={styles.text}>
            Using this application will help Acadia National Park officials decrease the park's heavy traffic and
            make visiting the park with a vehicle a less stressful experience.
            We appreciate your support.
          </Text>  
        </View>
  
        <View style = {styles.allowTracking}>
          <Text style={styles.text}>Allow Tracking</Text>
        </View>
  
        <View style = {styles.switchPosition}>
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
                      'Conetent-Type': 'application/x-www-form-urlencode'
                    },
                    body: 'uuid='.concat(this.state.uuid),
                    method:'POST',
                  })
                  .then((response) => {
                    if (respose.status === 400) {
                      Alert.alert(
                        'Connection failed.',
                        'Connection failed. Try again later or contact the developers at bhiqp@wpi.edu \n\nUUID: '.concat(this.state.uuid)
                      )
                    }
                    this.setState({
                      isTracking: false
                    })
                  })
                  .catch(error => console.error(error))
                }
              ]
            );
          }}
          >
          <Text style={styles.optBtnText}>Delete Tracking Data</Text>
        </TouchableOpacity>
  
        <View style = {styles.bottom}>
          <Text style = {styles.bottomText}>
            App Icon credits: Nick Roach
          </Text>
        </View>
  
      </View>
  
    )
  
  }
}

AppRegistry.registerComponent('App', () => App);

const styles = StyleSheet.create({

  container: {
    flex: 1,
    backgroundColor: '#ffffff'
  },

  text: {
    color: '#000000',
    marginLeft: 0,
    fontSize: 20,
  },

  statusBar: {
    height: Platform.OS === 'ios' ? 20 : StatusBar.currentHeight,
    backgroundColor: '#4885ed'
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
    fontSize: 20,
    justifyContent: 'center',
  },

  infoPara: {
    position: 'absolute',
    top: '15%',
    marginLeft: 20,
    marginRight: 20,
  },

  bottom: {
    position: 'absolute',
    top: '95%',
    marginBottom: 5,
    marginLeft: 20,
    marginLeft: 0
  },

  bottomText: {
    fontSize: Platform.OS === 'ios' ? 10 : 15,
    marginLeft: '7%'
  },

  allowTracking: {
    position: 'absolute',
    top: '60%',
    marginLeft: '7%',
  },

  switch: {
  },

  switchPosition: {
    position: 'absolute',
    top: '60%',
    right: '10%',
  },

  optBtn: {
    position: 'absolute',
    bottom: '15%',
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
    fontSize: 20,
    color: '#ffffff',
  }
})
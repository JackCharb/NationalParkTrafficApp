import React from 'react';
import { AppRegistry, StyleSheet, Text, View, Button, Switch, AsyncStorage, NetInfo } from 'react-native';

import BackgroundGeolocation from "react-native-background-geolocation";

export default class App extends React.Component {
  constructor() {
    super();

    this.state = {
      lat: 0.0,
      long: 0.0,
      time: 0,
      uuid: null,
      numCached: 0,
      connection: "none",
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
      desiredAccuracy: 0,
      distanceFilter: 10,
      debug: false,
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

  async getUUID() {
    AsyncStorage.setItem('lats', "")
    AsyncStorage.setItem('longs', "")
    AsyncStorage.setItem('times', "")

    {/*For testing purposes: AsyncStorage.removeItem("uuid");*/}

    var storedUUID = await AsyncStorage.getItem("uuid");
    if (storedUUID !== null) {
      console.debug("use pre-existing uuid")
      this.setState({uuid: storedUUID})
    }
    else {
      console.debug("request new uuid")
      {/*Get UUID from server*/}
      await fetch('https://bhiqp.ky8.io/reg', {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: 'appkey=9355552b2db866c13b123333d10603007101597ea87b75eb3ebb370c7748fb81'
        ,
        method: 'POST'
      })
      .then((response) => response.json())
      .then((response) => this.setState({uuid: response.uuid}))
      .catch(error => console.error(error));
      {/*TODO error handling*/}

      AsyncStorage.setItem('uuid', this.state.uuid)
    }
  }

  ret = this.getUUID();

  watchID = BackgroundGeolocation.watchPosition(async (position) => {
    console.log("connectionsdad: ", this.state.connection)
    {/*Check is user in within park bounds and allows tracking*/}
    {/*TODO: use actual park bounds*/}
    if ((this.state.isTracking) && (position.coords.longitude < 900) && (position.coords.longitude > -900)
        && (position.coords.latitude < 900) && (position.coords.latitude > -900)) {
      this.setState({
        lat: position.coords.latitude,
        long: position.coords.longitude,
        time: Math.floor(new Date().getTime() / 1000),
      });

      {/*Send data if phone has wifi*/}
      if (this.state.connection == "wifi") {
        console.debug("send")
        fetch('https://bhiqp.ky8.io/report', {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: 'uuid='.concat(this.state.uuid,'&time=', this.state.time, '&lat=', this.state.lat, '&lon=', this.state.long),
          method: 'POST'
        })
        .then(response => this.state)
        .catch(error => console.error(error));
        {/*TODO if status 401 getuuid() else if status not 200 store*/}

        {/*Send any stored data*/}
        if(this.state.numCached > 0) {
          {/*Send batch*/}
          lats = await AsyncStorage.getItem('lats')
          longs = await AsyncStorage.getItem('longs')
          times = await AsyncStorage.getItem('times')
          fetch('https://bhiqp.ky8.io/batch_report', {
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: 'uuid='.concat(this.state.uuid,'&times=', times, '&lats=', lats, '&lons=', longs),
            method: 'POST'
          })
          .then(response => this.state)
          .catch(error => console.error(error));
          {/*TODO if status 401 getuuid() else if status not 200
             do not clear cache*/}

          {/*Clear cache and set numCached to 0*/}
          AsyncStorage.setItem('lats', "")
          AsyncStorage.setItem('longs', "")
          AsyncStorage.setItem('times', "")

          this.setState({
            numCached: 0
          })
        }

      }
      else if (this.state.connection == "cell"){
        {/*Store*/}
        if (this.state.numCached === 0) {
          AsyncStorage.mergeItem('lats', JSON.stringify(this.state.lats))
          AsyncStorage.mergeItem('longs', JSON.stringify(this.state.longs))
          AsyncStorage.mergeItem('times', JSON.stringify(this.state.times))
        }
        else {
          AsyncStorage.mergeItem('lats', ','.concat(JSON.stringify(this.state.lats)))
          AsyncStorage.mergeItem('longs', ','.concat(JSON.stringify(this.state.longs)))
          AsyncStorage.mergeItem('times', ','.concat(JSON.stringify(this.state.times)))
        }
        
        {/*Increase count of cached points*/}
        this.setState({
          numCached: this.state.numCached + 1
        })

        {/*Send cache if it contains 25 data points*/}
        if (this.state.numCached > 24) {
          {/*Send batch*/}
          lats = await AsyncStorage.getItem('lats')
          longs = await AsyncStorage.getItem('longs')
          times = await AsyncStorage.getItem('times')
          fetch('https://bhiqp.ky8.io/batch_report', {
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: 'uuid='.concat(this.state.uuid,'&times=', times, '&lats=', lats, '&lons=', longs),
            method: 'POST'
          })
          .then(response => this.state)
          .catch(error => console.error(error));
          {/*TODO if status 401 getuuid() else if status not 200
             do not clear cache*/}

          {/*Clear cache and set numCached to 0*/}
          AsyncStorage.setItem('lats', "")
          AsyncStorage.setItem('longs', "")
          AsyncStorage.setItem('times', "")

          this.setState({
            numCached: 0
          })
        }
      }
        
      else {
        {/*Store*/}
        if (this.state.numCached === 0) {
          AsyncStorage.mergeItem('lats', JSON.stringify(this.state.lats))
          AsyncStorage.mergeItem('longs', JSON.stringify(this.state.longs))
          AsyncStorage.mergeItem('times', JSON.stringify(this.state.times))
        }
        else {
          AsyncStorage.mergeItem('lats', ','.concat(JSON.stringify(this.state.lats)))
          AsyncStorage.mergeItem('longs', ','.concat(JSON.stringify(this.state.longs)))
          AsyncStorage.mergeItem('times', ','.concat(JSON.stringify(this.state.times)))
        }

        {/*Increase count of cached points*/}
        this.setState({
          numCached: this.state.numCached + 1
        })
      }

    }
  },
  (error) => alert(JSON.stringify(error)),
  {enableHighAccuracy: true, distanceFilter: 5})

  render() {
    {/*Print position to the screen*/}
    return (
      <View style={styles.container}>
        <Text>Latitude: {this.state.lat}</Text>
        <Text>Longitude: {this.state.long}</Text>
        <Text>Time: {this.state.time.toLocaleString()}</Text>
        <Text>UUID: {this.state.uuid}</Text>
        <Text>numCached: {this.state.numCached}</Text>
      </View>
    );
  }
}

AppRegistry.registerComponent('App', () => App);

const styles = StyleSheet.create({

  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
    
  TextStyle:{
    color:'#fff',
    textAlign:'center',
  }
});

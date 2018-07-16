render() {

  return (

    <View style={styles.container}>

      <View style={styles.statusBar}>
        <StatusBar/>
      </View>

      <View style={styles.headerView}>

        <Text style = {styles.headerText}>
          {'Acadia Traffic Data Collection'}
        </Text>

      </View>

      <View style = {styles.infoPara}>
        <Text style={styles.text}>
          This application will help Acadia National Park officials decrease the park's heavy traffic and
          make visiting the park with a vehicle a less stressful experience.
          We appreciate your support in making Acadia safer and preserving its incredible beauty.
        </Text>  
      </View>

      <View style = {styles.allowTracking}>
        <Text style={styles.text}>Allow Tracking</Text>

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
                .then(response => this.state)
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
          UUID = {this.state.UUID}{'\n'}
          App Icon credits: 
        </Text>
      </View>

    </View>

  )

}

const styles = StyleSheet.create({

  container: {
    flex: 1,
    backgroundColor: '#ffffff'
  },

  text: {
    color: '#000000',
    alignContent: 'left',
    fontSize: 20
  }

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
    position: '20%',
    marginTop: 30,
    marginLeft: 20,
    alignContent: 'left'
  },

  bottom: {
    position: '90%',
    marginBottom: 20,
    marginLeft: 20,
    alignContent: 'left'
  },

  bottomText: {
    fontSize: Platform.OS === 'ios' ? 10 : 15,
    alignContent: 'left'
  },

  allowTracking: {
    position: '70%'
  }

  switch: {
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
    fontSize: 20
    color: '#ffffff'
  }


})
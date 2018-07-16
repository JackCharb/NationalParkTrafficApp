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
		fontSize: Platform.OS === 'ios' ? 20 : 25,
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
    fontSize: Platform.OS === 'ios' ? 20 : 25,
    justifyContent: 'center',
  },

  infoPara: {
  	marginTop: 30,
  	marginLeft: 20,
  	alignContent: 'left'
  },

  bottom: {
  	marginBottom: 20,
  	marginLeft: 20,
  	alignContent: 'left'

  },

  bottomText: {
  	fontSize: Platform.OS === 'ios' ? 10 : 15,
  	alignContent: 'left'
  }


})
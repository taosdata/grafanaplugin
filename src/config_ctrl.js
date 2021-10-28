export class GenericDatasourceConfigCtrl {
    /** @ngInject */
    constructor($scope, $injector, $q) {
        console.log(this);
        if(!this.current.jsonData.user) {
            this.current.jsonData.user="root";
        }
        if(!this.current.jsonData.password) {
            this.current.jsonData.password="taosdata";
        }
        console.log(this);
    }
  }

GenericDatasourceConfigCtrl.templateUrl = 'partials/config.html';
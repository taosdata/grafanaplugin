export class GenericDatasourceConfigCtrl {
    /** @ngInject */
    constructor($scope, $injector, $q) {
        if(!this.current.jsonData.user) {
            this.current.jsonData.user="root";
        }
        if(!this.current.jsonData.password) {
            this.current.jsonData.password="taosdata";
        }
    }
  }

GenericDatasourceConfigCtrl.templateUrl = 'partials/config.html';
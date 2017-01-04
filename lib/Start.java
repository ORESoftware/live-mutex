

public class Start {

   public String v(String s){
      throw new Error("run-time error!");
   }


   public static void main(String[] args){

      System.out.println("vars");
      new Start().v(null);

   }


}